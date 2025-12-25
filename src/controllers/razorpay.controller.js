import RazorpayService from "../services/razorpay.service.js";

class RazorpayController {
  async createOrder(req, res) {
    try {
      const { amount, firestoreOrderId } = req.body;

      if (!amount || !firestoreOrderId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const order = await RazorpayService.createOrder(amount, firestoreOrderId);

      res.json({ success: true, order });
    } catch (error) {
      console.error("Create Order Error:", error);
      res.status(500).json({ error: "Failed to create order" });
    }
  }

  async verifyPayment(req, res) {
    try {
      const { orderId, paymentId, signature, firestoreOrderId } = req.body;

      const result = await RazorpayService.verifyPayment({
        orderId,
        paymentId,
        signature,
        firestoreOrderId,
      });

      if (!result.verified) {
        // ❗ signature invalid → definitely failed
        await RazorpayService.markPaymentFailed(
          firestoreOrderId,
          "invalid_signature"
        );

        return res.status(400).json({
          success: false,
          message: "Invalid signature",
        });
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Verify Payment Error:", error);
      res.status(500).json({ error: "Payment verification failed" });
    }
  }

  async paymentFailed(req, res) {
    try {
      const { firestoreOrderId, reason } = req.body;

      if (!firestoreOrderId) {
        return res.status(400).json({ error: "Missing order id" });
      }

      await RazorpayService.markPaymentFailed(
        firestoreOrderId,
        reason || "payment_failed"
      );

      res.json({ success: true });
    } catch (error) {
      console.error("Payment Failed Error:", error);
      res.status(500).json({ error: "Failed to mark payment failed" });
    }
  }
}

export default new RazorpayController();
