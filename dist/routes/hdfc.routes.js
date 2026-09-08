// src-ts/routes/hdfc.routes.ts
// HDFC Collect Now payment routes.
// Mirrors existing razorpay.routes.js endpoints and adds:
//   POST /webhook      — webhook receiver (raw body for HMAC verification)
//   POST /status       — payment status inquiry
//   POST /reconcile    — crash-recovery reconciliation
//
// IMPORTANT: The webhook route MUST be registered BEFORE the global
// express.json() middleware in server.js so that req.body is a raw
// Buffer for HMAC signature verification.
import express, { Router } from "express";
import { createOrder, verifyPayment, paymentFailed, cancelOrder, checkPaymentStatus, reconcileOrder, handleWebhook, } from "../controller/hdfc.controller.js";
const router = Router();
// express.raw() is available on the default Express object.
// Used to get the raw request body buffer for HMAC signature verification.
const rawParser = express.raw({ type: "application/json" });
// Webhook — raw body required for HMAC signature verification.
// This route-level middleware overrides the global express.json()
// so that req.body is a Buffer containing the raw request body.
router.post("/webhook", rawParser, handleWebhook);
// Payment endpoints (JSON body)
router.post("/create-order", createOrder);
router.post("/verify-payment", verifyPayment);
router.post("/payment-failed", paymentFailed);
router.post("/cancel-order", cancelOrder);
// Status inquiry
router.post("/status", checkPaymentStatus);
// Reconciliation / crash recovery
router.post("/reconcile", reconcileOrder);
export default router;
