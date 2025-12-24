import FirebaseDatasource from "../services/datasource/FirebaseDatasource.js";
import reports from "../services/reports/index.js";

const datasource = new FirebaseDatasource();

function resolveDateRange(body) {
  const { mode, date, startDate, endDate } = body;

  let from, to;

  if (mode === "today") {
    const today = new Date();
    from = new Date(today.setHours(0, 0, 0, 0));
    to = new Date(today.setHours(23, 59, 59, 999));
  } else if (mode === "date") {
    if (!date) throw new Error("date is required");
    from = new Date(`${date}T00:00:00`);
    to = new Date(`${date}T23:59:59`);
  } else if (mode === "range") {
    if (!startDate || !endDate)
      throw new Error("startDate and endDate are required");
    from = new Date(`${startDate}T00:00:00`);
    to = new Date(`${endDate}T23:59:59`);
  } else {
    throw new Error("Invalid mode");
  }

  return { from, to };
}

export async function generateReport(req, res) {
  try {
    const { reportType } = req.body;

    const reportFn = reports[reportType];
    if (!reportFn) {
      return res.status(400).json({ error: "Invalid report type" });
    }

    const { from, to } = resolveDateRange(req.body);

    const orders = await datasource.getOrdersByDateRange(from, to);

    // 🔥 KEY FIX: await + datasource injected
    const reportJson = await reportFn(
      orders,
      {
        from: from.toISOString(),
        to: to.toISOString(),
      },
      datasource
    );

    res.json(reportJson);
  } catch (err) {
    console.error("Report error:", err);
    res.status(500).json({ error: err.message });
  }
}
