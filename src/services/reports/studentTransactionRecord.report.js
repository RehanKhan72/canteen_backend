import transactionHistoryReport from "./transactionHistory.report.js";

export default async function studentTransactionRecordReport(
  orders,
  meta,
  datasource
) {
  // 1️⃣ Base transaction history (now FIXED)
  const base = transactionHistoryReport(orders, meta);

  // 2️⃣ Collect unique userIds
  const userIds = [
    ...new Set(base.rows.map(r => r.userUid).filter(Boolean)),
  ];

  // 3️⃣ Fetch user names
  const userMap = await datasource.getUsersByIds(userIds);

  // 4️⃣ Enrich rows
  const rows = base.rows.map(row => {
    const createdDate = new Date(row.createdAt);

    return {
      sr: row.sr,
      studentName: userMap[row.userUid] ?? "Unknown",
      date: createdDate.toLocaleDateString("en-IN"),
      time: createdDate.toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: false,
      }),
      amount: row.amount, // ✅ already correct
    };
  });

  return {
    reportType: "student_transaction_record",
    title: "Student Transaction Record",

    generatedAt: Date.now(),

    dateRange: base.dateRange,

    columns: [
      { key: "sr", label: "Sr. No" },
      { key: "studentName", label: "Student Name" },
      { key: "date", label: "Date" },
      { key: "time", label: "Time" },
      { key: "amount", label: "Amount" },
    ],

    rows,

    summary: {
      label: "Sum",
      amount: base.summary.amount, // ✅ consistent
    },

    meta: {
      currency: "INR",
      orderCount: rows.length,
    },
  };
}
