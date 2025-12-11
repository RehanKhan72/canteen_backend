import express from "express";
import cors from "cors";
import dotenv from "dotenv";
dotenv.config();

import notificationRoutes from "./src/routes/notification.routes.js";

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/notify", notificationRoutes);

app.get("/", (req, res) => {
  res.send("Canteen Backend Running");
});

app.listen(process.env.PORT || 8080, () => {
  console.log("Server running on port", process.env.PORT);
});
