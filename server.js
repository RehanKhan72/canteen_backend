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
// Non-webhook routes have their own express.json() middleware.
app.use("/api/razorpay", hdfcRoutes);
console.log("[STARTUP] HDFC payment routes mounted at /api/razorpay");

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

// Debug endpoint — list registered routes (remove in production)
app.get("/debug/routes", (req, res) => {
  const routes = [];
  app._router.stack.forEach((middleware) => {
    if (middleware.route) {
      routes.push({ method: Object.keys(middleware.route.methods).join(","), path: middleware.route.path });
    } else if (middleware.name === "router" && middleware.handle.stack) {
      middleware.handle.stack.forEach((handler) => {
        if (handler.route) {
          const prefix = middleware.regexp.toString()
            .replace("/^\\\\/", "").replace("\\/?(?=\\\\/|$)/i", "").replace(/\\/g, "");
          routes.push({ method: Object.keys(handler.route.methods).join(","), path: "/" + prefix + handler.route.path });
        }
      });
    }
  });
  res.json(routes);
});

// 🔥 IMPORTANT: use server.listen
server.listen(process.env.PORT || 8080, () => {
  console.log("Server running on port", process.env.PORT || 8080);
});
