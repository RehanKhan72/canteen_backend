// src-ts/controller/hdfc.controller.ts
// HDFC Collect Now payment controller.
// Mirrors the existing razorpay.controller.js endpoints and adds:
//   POST /status       — payment status inquiry
//   POST /reconcile    — crash-recovery reconciliation
//   POST /webhook      — HDFC webhook receiver (raw body, HMAC verified)
import crypto from "crypto";
import HdfcService from "../services/hdfc.service.js";
export const createOrder = async (req, res) => {
    try {
        const { amount, firestoreOrderId } = req.body;
        if (!amount || !firestoreOrderId) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const order = await HdfcService.createOrder(amount, firestoreOrderId);
        res.json({ success: true, order });
    }
    catch (error) {
        console.error("Create Order Error:", error);
        res.status(500).json({ error: "Failed to create order" });
    }
};
export const verifyPayment = async (req, res) => {
    try {
        const { orderId, paymentId, signature, firestoreOrderId } = req.body;
        if (!orderId || !paymentId || !signature || !firestoreOrderId) {
            return res.status(400).json({ error: "Missing required fields" });
        }
        const result = await HdfcService.verifyPayment({
            orderId,
            paymentId,
            signature,
            firestoreOrderId,
        });
        if (!result.verified) {
            await HdfcService.markPaymentFailed(firestoreOrderId, "invalid_signature");
            return res.status(400).json({ success: false, message: "Invalid signature" });
        }
        res.json({ success: true });
    }
    catch (error) {
        console.error("Verify Payment Error:", error);
        res.status(500).json({ error: "Payment verification failed" });
    }
};
export const paymentFailed = async (req, res) => {
    try {
        const { firestoreOrderId, reason } = req.body;
        if (!firestoreOrderId) {
            return res.status(400).json({ error: "Missing order id" });
        }
        await HdfcService.markPaymentFailed(firestoreOrderId, reason || "payment_failed");
        res.json({ success: true });
    }
    catch (error) {
        console.error("Payment Failed Error:", error);
        res.status(500).json({ error: "Failed to mark payment failed" });
    }
};
export const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.body;
        if (!orderId) {
            return res.status(400).json({ message: "orderId required" });
        }
        const result = await HdfcService.cancelAndRefund(orderId);
        return res.json(result);
    }
    catch (error) {
        console.error("Cancel error:", error);
        return res.status(500).json({ message: "Cancel failed" });
    }
};
// ================================================================
// PHASE 3 — Payment status inquiry
// ================================================================
export const checkPaymentStatus = async (req, res) => {
    try {
        const { paymentId } = req.body;
        if (!paymentId) {
            return res.status(400).json({ error: "Missing paymentId" });
        }
        const result = await HdfcService.queryPaymentStatus(paymentId);
        res.json({ success: true, status: result.status, raw: result.raw });
    }
    catch (error) {
        console.error("Payment status query error:", error);
        res.status(500).json({ error: "Failed to query payment status" });
    }
};
// ================================================================
// PHASE 5 — Reconciliation (crash recovery)
// ================================================================
export const reconcileOrder = async (req, res) => {
    try {
        const { firestoreOrderId } = req.body;
        if (!firestoreOrderId) {
            return res.status(400).json({ error: "Missing firestoreOrderId" });
        }
        const result = await HdfcService.reconcileOrder(firestoreOrderId);
        res.json({ success: true, ...result });
    }
    catch (error) {
        console.error("Reconciliation error:", error);
        res.status(500).json({ error: "Reconciliation failed" });
    }
};
// ================================================================
// PHASE 4 — Webhook endpoint
// ================================================================
/**
 * Verify the HMAC signature of an incoming webhook request.
 * Uses the raw request body buffer and the RAZORPAY_SECRET.
 */
function verifyWebhookSignature(rawBody, signature, secret) {
    if (!signature)
        return false;
    const expectedSignature = crypto
        .createHmac("sha256", secret)
        .update(rawBody)
        .digest("hex");
    return expectedSignature === signature;
}
export const handleWebhook = async (req, res) => {
    try {
        const signature = req.headers["x-razorpay-signature"];
        const rawBody = req.body;
        if (!verifyWebhookSignature(rawBody, signature, process.env.RAZORPAY_SECRET)) {
            console.warn("Webhook signature verification failed");
            return res.status(401).json({ error: "Invalid signature" });
        }
        const event = JSON.parse(rawBody.toString("utf8"));
        console.log("Webhook received:", event.event);
        const result = await HdfcService.handleWebhookEvent(event);
        res.json({ success: true, ...result });
    }
    catch (error) {
        console.error("Webhook processing error:", error);
        res.status(500).json({ error: "Webhook processing failed" });
    }
};
