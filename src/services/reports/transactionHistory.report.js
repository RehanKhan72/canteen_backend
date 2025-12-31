// src/services/reports/transactionHistory.report.js

export default function transactionHistoryReport(orders, meta) {
  // Sort by createdAt (epoch ms)
  const sortedOrders = [...orders].sort(
    (a, b) => a.createdAt - b.createdAt
  );

  let sum = 0;

  const rows = sortedOrders.map((order, index) => {
    // ✅ RECOMPUTE ORDER AMOUNT FROM ITEMS
    const orderAmount = (order.items || []).reduce(
      (acc, item) =>
        acc + Number(item.price || 0) * Number(item.quantity || 0),
      0
    );

    sum += orderAmount;

    // Convert epoch → Date ONLY for formatting
    const dateObj = new Date(order.createdAt);

    const time = dateObj.toLocaleTimeString("en-IN", {
      timeZone: "Asia/Kolkata",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    });

    return {
      sr: index + 1,
      time,
      amount: orderAmount, // ✅ FIXED
      userUid: order.userUid,
      createdAt: order.createdAt, // epoch ms
    };
  });

  return {
    reportType: "transaction_history",
    title: "Transaction History",

    generatedAt: Date.now(),

    dateRange: {
      from: meta.from,
      to: meta.to,
    },

    columns: [
      { key: "sr", label: "Sr. No" },
      { key: "time", label: "Time" },
      { key: "amount", label: "Amount" },
    ],

    rows,

    summary: {
      label: "Sum",
      amount: sum, // ✅ guaranteed correct now
    },

    meta: {
      currency: "INR",
      orderCount: rows.length,
    },
  };
}
