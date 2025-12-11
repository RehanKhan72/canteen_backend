import express from "express";
import notificationController from "../controllers/notification.controller.js";

const router = express.Router();

router.post("/new-order", notificationController.sendNewOrder);
router.post("/order-status", notificationController.sendOrderStatus);

export default router;
