const DEFAULT_EXPIRY_DAYS = {
  milk: 7,
  yogurt: 10,
  spinach: 5,
  lettuce: 5,
  banana: 6,
  apple: 21,
  bread: 8,
  egg: 21,
  chicken: 3,
  fish: 2,
};

function guessExpiryDays(productName) {
  const normalized = productName.toLowerCase();
  const match = Object.keys(DEFAULT_EXPIRY_DAYS).find((k) => normalized.includes(k));
  return match ? DEFAULT_EXPIRY_DAYS[match] : 14;
}

function parseReceiptPayload(rawPayload = '{}') {
  let parsed;
  try {
    parsed = JSON.parse(rawPayload);
  } catch {
    throw new Error('Invalid JSON in mock receipt payload');
  }

  if (!Array.isArray(parsed.items) || parsed.items.length === 0) {
    throw new Error('mock payload must include a non-empty items array');
  }

  const normalizedItems = parsed.items.map((item) => {
    const qty = Number(item.quantity ?? 1);
    const price = item.price != null ? Number(item.price) : null;
    const name = String(item.name || '').trim();
    const unit = String(item.unit || 'count').trim();

    if (!name) {
      throw new Error('each item requires a name');
    }
    if (!Number.isFinite(qty) || qty <= 0) {
      throw new Error(`invalid quantity for ${name}`);
    }

    return {
      name,
      quantity: qty,
      unit,
      price: Number.isFinite(price) ? price : null,
      estimated_expiry_days: Number(item.estimated_expiry_days) || guessExpiryDays(name),
    };
  });

  const total = parsed.total != null
    ? Number(parsed.total)
    : normalizedItems.reduce((sum, item) => sum + (item.price || 0), 0);

  return {
    merchant: parsed.merchant || 'Unknown Merchant',
    purchased_at: parsed.purchased_at || new Date().toISOString(),
    total: Number.isFinite(total) ? total : 0,
    items: normalizedItems,
  };
}

function parseFromUploadFallback(file) {
  const baseName = file.originalname.replace(/\.[^.]+$/, '');
  const prettyName = baseName.replace(/[_-]+/g, ' ').trim() || 'receipt item';
  return {
    merchant: 'Uploaded Receipt',
    purchased_at: new Date().toISOString(),
    total: 0,
    items: [{
      name: prettyName,
      quantity: 1,
      unit: 'count',
      price: null,
      estimated_expiry_days: guessExpiryDays(prettyName),
    }],
  };
}

module.exports = {
  parseReceiptPayload,
  parseFromUploadFallback,
};
