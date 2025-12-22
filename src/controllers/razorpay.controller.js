// src/controllers/razorpay.controller.js
import RazorpayService from "../services/razorpay.service.js";

class RazorpayController {
  async createOrder(req, res) {
    try {
      const { amount, firestoreOrderId } = req.body;

      if (!amount || !firestoreOrderId) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      const order = await RazorpayService.createOrder(amount, firestoreOrderId);

      res.json({
        success: true,
        order,
      });
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
        return res.status(400).json({ success: false, message: "Invalid signature" });
      }

      res.json({ success: true, message: "Payment verified and Firestore updated" });
    } catch (error) {
      console.error("Verify Payment Error:", error);
      res.status(500).json({ error: "Payment verification failed" });
    }
  }
}

export default new RazorpayController();
