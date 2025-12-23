module.exports = function totalSalesReport(orders, dateRange) {
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
    dateRange,
    generatedAt: new Date().toISOString(),
    version: "1.0",
    data: {
      grossTotal,
      taxes: {
        cgst: { rate: cgstRate, amount: cgstAmount },
        sgst: { rate: sgstRate, amount: sgstAmount }
      },
      netTotal
    },
    meta: {
      currency: "INR"
    }
  };
};
