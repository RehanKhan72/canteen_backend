// src/controllers/report.controller.js

import MongoDatasource from "../services/datasource/MongoDatasource.js";
import reports from "../services/reports/index.js";

const datasource = new MongoDatasource();

/**
 * Resolve date range into epoch milliseconds
 */
function resolveDateRange(body) {
  const { mode, date, startDate, endDate } = body;

  let from, to;

  if (mode === "today") {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const end = new Date(start.getTime() + 24 * 60 * 60 * 1000 - 1);

    from = start.getTime();
    to = end.getTime();
  }
  else if (mode === "date") {
    if (!date) throw new Error("date is required");

    const start = new Date(`${date}T00:00:00`);
    const end = new Date(`${date}T23:59:59.999`);

    from = start.getTime();
    to = end.getTime();
  }
  else if (mode === "range") {
    if (!startDate || !endDate) {
      throw new Error("startDate and endDate are required");
    }

    from = new Date(`${startDate}T00:00:00`).getTime();
    to = new Date(`${endDate}T23:59:59.999`).getTime();
  }
  else {
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

    // ✅ Mongo-backed data fetch
    const orders = await datasource.getOrdersByDateRange(from, to);

    // ✅ Report logic unchanged, datasource injected
    const reportJson = await reportFn(
      orders,
      { from, to }, // epoch ms metadata
      datasource
    );

    res.json(reportJson);
  } catch (err) {
    console.error("Report error:", err);
    res.status(500).json({ error: err.message });
  }
}
