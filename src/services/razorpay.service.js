// src/services/razorpay.service.js
import crypto from "crypto";
import razorpayInstance from "../config/razorpay.js";
import firestoreService from "./firestore.service.js"; // you already have this service

class RazorpayService {
  async createOrder(amount, receiptId) {
    const options = {
      amount: amount * 100, // Razorpay expects paise
      currency: "INR",
      receipt: receiptId,
    };

    const order = await razorpayInstance.orders.create(options);
    return order;
  }

  async verifyPayment({ orderId, paymentId, signature, firestoreOrderId }) {
    const body = orderId + "|" + paymentId;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(body)
      .digest("hex");

    const isValid = expectedSignature === signature;

    if (!isValid) {
      return { verified: false };
    }

    // Update Firestore order (status = 0 = paid, pending acceptance)
    await firestoreService.updateOrderStatus(firestoreOrderId, {
      status: 0,
      paymentVerified: true,
      paymentDetails: {
        orderId,
        paymentId,
        signature,
        verifiedAt: new Date(),
      },
    });

    return { verified: true };
  }
}

export default new RazorpayService();
