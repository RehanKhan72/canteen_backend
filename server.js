import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import http from "http";
import { Server } from "socket.io";

dotenv.config();

import { connectMongo } from "./dist/config/mongodb.js"; // 🔥 now from dist

import notificationRoutes from "./src/routes/notification.routes.js";
import reportRoutes from "./src/routes/report.routes.js";
import hdfcRoutes from "./dist/routes/hdfc.routes.js";
import dataRoutes from "./src/routes/data.routes.js";
import kitchenRoutes from "./src/routes/kitchen.routes.js";
import KitchenScheduler from "./dist/services/KitchenScheduler.js";
import accountRoutes from "./dist/routes/accounts.routes.js";
// import passwordRoutes from "./dist/routes/password.routes.js";

import { initSocket } from "./dist/socket/SocketGateway.js";

const app = express();
app.use(cors());

// HDFC routes — mounted BEFORE express.json() so the /webhook endpoint
// receives a raw Buffer body for HMAC signature verification.
app.use("/api/razorpay", hdfcRoutes);

app.use(express.json());

await connectMongo();

// 🔥 Create HTTP server
const server = http.createServer(app);

// 🔥 Attach Socket.io
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// 🔥 Initialize Socket Gateway
initSocket(io);
KitchenScheduler.start();

app.use("/api/notify", notificationRoutes);
app.use("/reports", reportRoutes);
app.use("/api", dataRoutes);
app.use("/api/kitchen", kitchenRoutes);
app.use("/api", accountRoutes);
// app.use("/api", passwordRoutes);

app.get("/", (req, res) => {
  res.send("Canteen Backend Running");
});

// 🔥 IMPORTANT: use server.listen
server.listen(process.env.PORT || 8080, () => {
  console.log("Server running on port", process.env.PORT || 8080);
});
