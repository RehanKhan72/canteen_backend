export default function stockSoldReport(orders, meta) {
  /**
   * Aggregate quantities by product
   * key = prodId
   */
  const productMap = new Map();

  orders.forEach(order => {
    order.items.forEach(item => {
      const key = item.prodId;

      if (!productMap.has(key)) {
        productMap.set(key, {
          prodId: item.prodId,
          item: item.name,
          unit: item.unit,
          qty: 0,
        });
      }

      productMap.get(key).qty += Number(item.quantity || 0);
    });
  });

  /**
   * Convert map → array
   * Sort by qty DESC
   */
  const rows = Array.from(productMap.values())
    .sort((a, b) => b.qty - a.qty)
    .map((row, index) => ({
      sr: index + 1,
      prodId: row.prodId,
      item: row.item,
      qty: row.qty,
      unit: row.unit,
    }));

  const totalQty = rows.reduce((sum, r) => sum + r.qty, 0);

  return {
    reportType: "stock_sold",
    title: "Stock Sold",
    generatedAt: Date.now(),

    dateRange: {
      from: meta.from,
      to: meta.to,
    },

    columns: [
      { key: "sr", label: "Sr. No" },
      { key: "item", label: "Item" },
      { key: "qty", label: "Qty" },
    ],

    rows,

    summary: {
      label: "Total Quantity Sold",
      uniqueItems: rows.length,
      totalQty,
    },

    meta: {
      orderCount: orders.length,
    },
  };
}
