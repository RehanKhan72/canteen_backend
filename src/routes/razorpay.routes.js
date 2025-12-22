// src/routes/razorpay.routes.js
import express from "express";
import RazorpayController from "../controllers/razorpay.controller.js";

const router = express.Router();

router.post("/create-order", RazorpayController.createOrder);
router.post("/verify-payment", RazorpayController.verifyPayment);

export default router;
