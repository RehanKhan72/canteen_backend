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
        console.log(`[PAYMENT] create-order received: amount=${amount}, firestoreOrderId=${firestoreOrderId}`);
        if (!amount || !firestoreOrderId) {
            console.warn("[PAYMENT] create-order missing fields:", { amount, firestoreOrderId });
            return res.status(400).json({ error: "Missing required fields" });
        }
        console.log("[PAYMENT] create-order calling HDFC API...");
        const order = await HdfcService.createOrder(amount, firestoreOrderId);
        console.log("[PAYMENT] create-order success: orderId=", order.id);
        res.json({ success: true, order });
    }
    catch (error) {
        console.error("[PAYMENT] create-order FAILED:", error?.message || error);
        res.status(500).json({ error: "Failed to create order" });
    }
};
export const verifyPayment = async (req, res) => {
    try {
        const { orderId, paymentId, signature, firestoreOrderId } = req.body;
        console.log(`[PAYMENT] verify-payment received: orderId=${orderId}, paymentId=${paymentId}, firestoreOrderId=${firestoreOrderId}`);
        if (!orderId || !paymentId || !signature || !firestoreOrderId) {
            console.warn("[PAYMENT] verify-payment missing fields");
            return res.status(400).json({ error: "Missing required fields" });
        }
        console.log("[PAYMENT] verify-payment verifying signature...");
        const result = await HdfcService.verifyPayment({
            orderId,
            paymentId,
            signature,
            firestoreOrderId,
        });
        if (!result.verified) {
            console.warn("[PAYMENT] verify-payment INVALID SIGNATURE for order:", firestoreOrderId);
            await HdfcService.markPaymentFailed(firestoreOrderId, "invalid_signature");
            return res.status(400).json({ verified: false, state: "FAILED", message: "Invalid signature" });
        }
        const paymentState = result.ignored ? "SUCCESS" : "SUCCESS";
        console.log(`[PAYMENT] verify-payment success for order: ${firestoreOrderId}, state: ${paymentState}`);
        res.json({ verified: true, state: paymentState });
    }
    catch (error) {
        console.error("[PAYMENT] verify-payment FAILED:", error?.message || error);
        res.status(500).json({ error: "Payment verification failed" });
    }
};
export const paymentFailed = async (req, res) => {
    try {
        const { firestoreOrderId, reason } = req.body;
        console.log(`[PAYMENT] payment-failed received: firestoreOrderId=${firestoreOrderId}, reason=${reason}`);
        if (!firestoreOrderId) {
            return res.status(400).json({ error: "Missing order id" });
        }
        await HdfcService.markPaymentFailed(firestoreOrderId, reason || "payment_failed");
        console.log("[PAYMENT] payment-failed marked for order:", firestoreOrderId);
        res.json({ success: true });
    }
    catch (error) {
        console.error("[PAYMENT] payment-failed FAILED:", error?.message || error);
        res.status(500).json({ error: "Failed to mark payment failed" });
    }
};
export const cancelOrder = async (req, res) => {
    try {
        const { orderId } = req.body;
        console.log(`[PAYMENT] cancel-order received: orderId=${orderId}`);
        if (!orderId) {
            return res.status(400).json({ message: "orderId required" });
        }
        const result = await HdfcService.cancelAndRefund(orderId);
        console.log("[PAYMENT] cancel-order result:", result);
        return res.json(result);
    }
    catch (error) {
        console.error("[PAYMENT] cancel-order FAILED:", error?.message || error);
        return res.status(500).json({ message: "Cancel failed" });
    }
};
// ================================================================
// PHASE 3 — Payment status inquiry
// ================================================================
export const checkPaymentStatus = async (req, res) => {
    try {
        const { paymentId } = req.body;
        console.log(`[PAYMENT] status query received: paymentId=${paymentId}`);
        if (!paymentId) {
            return res.status(400).json({ error: "Missing paymentId" });
        }
        const result = await HdfcService.queryPaymentStatus(paymentId);
        console.log(`[PAYMENT] status query result: ${result.status}`);
        res.json({ success: true, status: result.status, raw: result.raw });
    }
    catch (error) {
        console.error("[PAYMENT] status query FAILED:", error?.message || error);
        res.status(500).json({ error: "Failed to query payment status" });
    }
};
// ================================================================
// PHASE 5 — Reconciliation (crash recovery)
// ================================================================
export const reconcileOrder = async (req, res) => {
    try {
        const { firestoreOrderId } = req.body;
        console.log(`[PAYMENT] reconcile received: firestoreOrderId=${firestoreOrderId}`);
        if (!firestoreOrderId) {
            return res.status(400).json({ error: "Missing firestoreOrderId" });
        }
        const result = await HdfcService.reconcileOrder(firestoreOrderId);
        console.log(`[PAYMENT] reconcile result:`, result);
        res.json({ success: true, ...result });
    }
    catch (error) {
        console.error("[PAYMENT] reconcile FAILED:", error?.message || error);
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
        console.log("[PAYMENT] webhook received, verifying signature...");
        if (!verifyWebhookSignature(rawBody, signature, process.env.RAZORPAY_SECRET)) {
            console.warn("[PAYMENT] webhook signature verification FAILED");
            return res.status(401).json({ error: "Invalid signature" });
        }
        const event = JSON.parse(rawBody.toString("utf8"));
        console.log("[PAYMENT] webhook event type:", event.event);
        const result = await HdfcService.handleWebhookEvent(event);
        console.log("[PAYMENT] webhook processed:", result);
        res.json({ success: true, ...result });
    }
    catch (error) {
        console.error("[PAYMENT] webhook processing FAILED:", error?.message || error);
        res.status(500).json({ error: "Webhook processing failed" });
    }
};
