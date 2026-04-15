const test = require('node:test');
const assert = require('node:assert/strict');

const { parseReceiptPayload } = require('../src/receiptParser');
const { buildSummary, predictWeeklyNeeds } = require('../src/recommendations');

test('parseReceiptPayload normalizes receipt items', () => {
  const payload = JSON.stringify({
    merchant: 'Kroger',
    items: [
      { name: 'Milk 1L', quantity: 2, unit: 'count', price: 3.25 },
      { name: 'Eggs', quantity: 1, unit: 'count', price: 4.5, estimated_expiry_days: 10 },
    ],
  });

  const parsed = parseReceiptPayload(payload);
  assert.equal(parsed.merchant, 'Kroger');
  assert.equal(parsed.items.length, 2);
  assert.equal(parsed.items[0].quantity, 2);
  assert.equal(parsed.total, 7.75);
});

test('buildSummary identifies expiring and expired items', () => {
  const now = Date.now();
  const pantry = [
    { id: 1, name: 'A', expires_at: new Date(now - 86400000).toISOString(), quantity: 1 },
    { id: 2, name: 'B', expires_at: new Date(now + 2 * 86400000).toISOString(), quantity: 1 },
    { id: 3, name: 'C', expires_at: null, quantity: 2 },
  ];

  const summary = buildSummary(pantry);
  assert.equal(summary.expired.length, 1);
  assert.equal(summary.expiring_soon.length, 1);
});

test('predictWeeklyNeeds recommends when usage > quantity on hand', () => {
  const pantry = [{ name: 'Milk', unit: 'count', quantity: 1 }];
  const usage = [{ name: 'Milk', unit: 'count', amount: 3 }];

  const results = predictWeeklyNeeds(pantry, usage);
  assert.equal(results.length, 1);
  assert.equal(results[0].recommended_order_qty, 2);
});
