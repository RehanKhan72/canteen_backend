// src/services/reports/transactionHistory.report.js

export default function transactionHistoryReport(orders, meta) {
  // Sort by createdAt (epoch ms)
  const sortedOrders = [...orders].sort(
    (a, b) => a.createdAt - b.createdAt
  );

  let sum = 0;

  const rows = sortedOrders.map((order, index) => {
    sum += order.overallTotal;

    // ✅ Convert epoch → Date ONLY for formatting
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
      amount: order.overallTotal,

      // 🔑 Keep RAW epoch for downstream composition
      userUid: order.userUid,
      createdAt: order.createdAt, // ✅ epoch ms ONLY
    };
  });

  return {
    reportType: "transaction_history",
    title: "Transaction History",

    // ✅ epoch ms (Flutter-safe)
    generatedAt: Date.now(),

    // ✅ epoch ms (Flutter-safe)
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
      amount: sum,
    },

    meta: {
      currency: "INR",
      orderCount: rows.length,
    },
  };
}
