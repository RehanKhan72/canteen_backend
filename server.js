import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import { connectMongo } from "./src/config/mongodb.js";

import notificationRoutes from "./src/routes/notification.routes.js";
import reportRoutes from "./src/routes/report.routes.js";
import razorpayRoutes from "./src/routes/razorpay.routes.js";
import dataRoutes from "./src/routes/data.routes.js";

const app = express();
app.use(cors());
app.use(express.json());

await connectMongo();

app.use("/api/notify", notificationRoutes);
app.use("/api/razorpay", razorpayRoutes);
app.use("/reports", reportRoutes);
app.use("/api", dataRoutes);

app.get("/", (req, res) => {
  res.send("Canteen Backend Running");
});

app.listen(process.env.PORT || 8080, () => {
  console.log("Server running on port", process.env.PORT);
});
