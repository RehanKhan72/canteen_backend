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
// Body parsers — applied per-route because this router is mounted
// BEFORE the global express.json() in server.js (required for
// the webhook endpoint to receive a raw Buffer for HMAC verification).
const jsonParser = express.json();
const rawParser = express.raw({ type: "application/json" });
// Webhook — raw body required for HMAC signature verification.
router.post("/webhook", rawParser, handleWebhook);
// Payment endpoints (JSON body)
router.post("/create-order", jsonParser, createOrder);
router.post("/verify-payment", jsonParser, verifyPayment);
router.post("/payment-failed", jsonParser, paymentFailed);
router.post("/cancel-order", jsonParser, cancelOrder);
// Status inquiry
router.post("/status", jsonParser, checkPaymentStatus);
// Reconciliation / crash recovery
router.post("/reconcile", jsonParser, reconcileOrder);
export default router;
