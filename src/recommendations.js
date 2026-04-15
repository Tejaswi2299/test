const DAY_MS = 24 * 60 * 60 * 1000;

function daysUntil(dateString) {
  if (!dateString) return null;
  const today = new Date();
  const target = new Date(dateString);
  return Math.ceil((target - today) / DAY_MS);
}

function buildSummary(pantryItems) {
  const expiringSoon = [];
  const expired = [];

  for (const item of pantryItems) {
    const days = daysUntil(item.expires_at);
    if (days == null) continue;
    if (days < 0) expired.push(item);
    else if (days <= 4) expiringSoon.push({ ...item, days_left: days });
  }

  const useFirst = pantryItems
    .filter((item) => item.expires_at)
    .sort((a, b) => new Date(a.expires_at) - new Date(b.expires_at))
    .slice(0, 5);

  return {
    total_items: pantryItems.length,
    expired,
    expiring_soon: expiringSoon,
    use_first: useFirst,
  };
}

function predictWeeklyNeeds(pantryItems, consumptionRows) {
  const byItem = new Map();
  for (const row of consumptionRows) {
    const key = `${row.name}::${row.unit}`;
    const current = byItem.get(key) || 0;
    byItem.set(key, current + row.amount);
  }

  return pantryItems
    .map((item) => {
      const key = `${item.name}::${item.unit}`;
      const weeklyConsumption = byItem.get(key) || 0;
      const recommended = Math.max(0, Math.ceil(weeklyConsumption - item.quantity));
      return {
        name: item.name,
        unit: item.unit,
        qty_on_hand: item.quantity,
        expected_weekly_use: Number(weeklyConsumption.toFixed(2)),
        recommended_order_qty: recommended,
      };
    })
    .filter((row) => row.recommended_order_qty > 0);
}

module.exports = {
  buildSummary,
  predictWeeklyNeeds,
};
