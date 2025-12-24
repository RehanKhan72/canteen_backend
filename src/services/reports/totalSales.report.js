export default function totalSalesReport(orders, meta) {
  const grossTotal = orders.reduce(
    (sum, o) => sum + o.overallTotal,
    0
  );

  const cgstRate = 2.5;
  const sgstRate = 2.5;

  const cgstAmount = (grossTotal * cgstRate) / 100;
  const sgstAmount = (grossTotal * sgstRate) / 100;

  const netTotal = grossTotal - cgstAmount - sgstAmount;

  return {
    reportType: "total_sales",
    title: "Total Sales Summary",
    generatedAt: new Date().toISOString(),

    dateRange: {
      from: meta.from,
      to: meta.to,
    },

    columns: [
      { key: "label", label: "Description" },
      { key: "amount", label: "Amount (₹)" },
    ],

    rows: [
      { sr: 1, label: "Gross Total", amount: grossTotal },
      {
        sr: 2,
        label: `CGST (${cgstRate}%)`,
        amount: cgstAmount,
      },
      {
        sr: 3,
        label: `SGST (${sgstRate}%)`,
        amount: sgstAmount,
      },
      {
        sr: 4,
        label: "Net Total",
        amount: netTotal,
      },
    ],

    summary: {
      label: "Net Total",
      amount: netTotal,
    },

    meta: {
      currency: "INR",
      orderCount: orders.length,
    },
  };
}
