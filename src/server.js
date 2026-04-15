const path = require('path');
const fs = require('fs');
const express = require('express');
const cors = require('cors');
const multer = require('multer');
const bcrypt = require('bcryptjs');
const db = require('./db');
const { generateToken, requireAuth } = require('./auth');
const { parseReceiptPayload, parseFromUploadFallback } = require('./receiptParser');
const { buildSummary, predictWeeklyNeeds } = require('./recommendations');

const app = express();
const port = process.env.PORT || 3000;

const uploadDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({ dest: uploadDir });

function safeDeleteFile(filePath) {
  if (!filePath) return;
  try {
    fs.unlinkSync(filePath);
  } catch (_error) {
    // best effort cleanup for rejected/failed uploads
  }
}

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok', service: 'smart-grocery-tracker' });
});

app.post('/api/auth/register', async (req, res) => {
  const { name, email, password } = req.body || {};
  if (!name || !email || !password) {
    return res.status(400).json({ error: 'name, email and password are required' });
  }

  const passwordHash = await bcrypt.hash(password, 10);
  try {
    const insert = db.prepare('INSERT INTO users (name, email, password_hash) VALUES (?, ?, ?)');
    const result = insert.run(name, email.toLowerCase(), passwordHash);
    const user = { id: result.lastInsertRowid, email: email.toLowerCase() };
    return res.status(201).json({ token: generateToken(user), user });
  } catch (error) {
    if (String(error.message).includes('UNIQUE')) {
      return res.status(409).json({ error: 'Email already exists' });
    }
    return res.status(500).json({ error: 'Could not register user' });
  }
});

app.post('/api/auth/login', async (req, res) => {
  const { email, password } = req.body || {};
  if (!email || !password) {
    return res.status(400).json({ error: 'email and password are required' });
  }

  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email.toLowerCase());
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = await bcrypt.compare(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  return res.json({
    token: generateToken(user),
    user: { id: user.id, name: user.name, email: user.email },
  });
});

app.post('/api/receipts/upload', requireAuth, upload.single('receipt'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'receipt file is required' });
  }

  let receiptData;
  try {
    receiptData = req.body.mockPayload
      ? parseReceiptPayload(req.body.mockPayload)
      : parseFromUploadFallback(req.file);
  } catch (error) {
    safeDeleteFile(req.file.path);
    return res.status(400).json({ error: error.message });
  }

  const receiptInsert = db.prepare(`
    INSERT INTO receipts (user_id, merchant, purchased_at, total, image_path, raw_payload)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const itemInsert = db.prepare(`
    INSERT INTO receipt_items (receipt_id, name, quantity, unit, price, estimated_expiry_days)
    VALUES (?, ?, ?, ?, ?, ?)
  `);

  const pantryUpsert = db.prepare(`
    INSERT INTO pantry_items (user_id, name, quantity, unit, expires_at, last_updated_at)
    VALUES (?, ?, ?, ?, ?, datetime('now'))
    ON CONFLICT(user_id, name, unit)
    DO UPDATE SET
      quantity = pantry_items.quantity + excluded.quantity,
      expires_at = CASE
        WHEN pantry_items.expires_at IS NULL THEN excluded.expires_at
        WHEN excluded.expires_at IS NULL THEN pantry_items.expires_at
        WHEN datetime(excluded.expires_at) < datetime(pantry_items.expires_at) THEN excluded.expires_at
        ELSE pantry_items.expires_at
      END,
      last_updated_at = datetime('now')
  `);

  const tx = db.transaction(() => {
    const receiptResult = receiptInsert.run(
      req.user.id,
      receiptData.merchant,
      receiptData.purchased_at,
      receiptData.total,
      req.file.path,
      req.body.mockPayload || null,
    );

    for (const item of receiptData.items) {
      itemInsert.run(
        receiptResult.lastInsertRowid,
        item.name,
        item.quantity,
        item.unit,
        item.price,
        item.estimated_expiry_days,
      );

      const expiresAt = new Date();
      expiresAt.setDate(expiresAt.getDate() + item.estimated_expiry_days);
      pantryUpsert.run(
        req.user.id,
        item.name,
        item.quantity,
        item.unit,
        expiresAt.toISOString(),
      );
    }

    return Number(receiptResult.lastInsertRowid);
  });

  try {
    const receiptId = tx();
    return res.status(201).json({
      message: 'Receipt processed',
      receipt_id: receiptId,
      parsed: receiptData,
    });
  } catch (_error) {
    safeDeleteFile(req.file.path);
    return res.status(500).json({ error: 'Failed to process receipt' });
  }
});

app.get('/api/pantry', requireAuth, (req, res) => {
  const pantry = db.prepare(
    'SELECT * FROM pantry_items WHERE user_id = ? ORDER BY datetime(expires_at) ASC, name ASC'
  ).all(req.user.id);

  const summary = buildSummary(pantry);
  return res.json({ pantry, summary });
});

app.post('/api/pantry/consume', requireAuth, (req, res) => {
  const { pantry_item_id, amount } = req.body || {};
  const numericAmount = Number(amount);

  if (!pantry_item_id || !Number.isFinite(numericAmount) || numericAmount <= 0) {
    return res.status(400).json({ error: 'pantry_item_id and positive amount are required' });
  }

  const pantryItem = db
    .prepare('SELECT * FROM pantry_items WHERE id = ? AND user_id = ?')
    .get(pantry_item_id, req.user.id);

  if (!pantryItem) {
    return res.status(404).json({ error: 'Pantry item not found' });
  }

  if (pantryItem.quantity < numericAmount) {
    return res.status(400).json({ error: 'Not enough quantity in stock' });
  }

  const tx = db.transaction(() => {
    db.prepare(
      'UPDATE pantry_items SET quantity = quantity - ?, last_updated_at = datetime(\'now\') WHERE id = ?'
    ).run(numericAmount, pantry_item_id);

    db.prepare(
      'INSERT INTO consumption_events (user_id, pantry_item_id, amount) VALUES (?, ?, ?)'
    ).run(req.user.id, pantry_item_id, numericAmount);
  });

  tx();
  return res.json({ message: 'Consumption logged' });
});

app.get('/api/recommendations', requireAuth, (req, res) => {
  const pantry = db.prepare('SELECT * FROM pantry_items WHERE user_id = ?').all(req.user.id);

  const consumption = db.prepare(`
    SELECT p.name, p.unit, SUM(c.amount) as amount
    FROM consumption_events c
    JOIN pantry_items p ON p.id = c.pantry_item_id
    WHERE c.user_id = ?
      AND datetime(c.consumed_at) >= datetime('now', '-7 days')
    GROUP BY p.name, p.unit
  `).all(req.user.id);

  const predictions = predictWeeklyNeeds(pantry, consumption);
  const lowStock = pantry
    .filter((item) => item.quantity <= 1)
    .map((item) => ({ name: item.name, unit: item.unit, qty_on_hand: item.quantity }));

  return res.json({ low_stock: lowStock, predictions });
});

app.get('*', (_req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.listen(port, () => {
  // eslint-disable-next-line no-console
  console.log(`Smart Grocery Tracker listening on http://localhost:${port}`);
});
