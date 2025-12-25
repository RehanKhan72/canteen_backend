// src/services/razorpay.service.js
import crypto from "crypto";
import razorpayInstance from "../config/razorpay.js";
import firestoreService from "./firestore.service.js";

class RazorpayService {
  async createOrder(amount, receiptId) {
    return razorpayInstance.orders.create({
      amount: amount * 100,
      currency: "INR",
      receipt: receiptId,
    });
  }

  async verifyPayment({ orderId, paymentId, signature, firestoreOrderId }) {
    const body = `${orderId}|${paymentId}`;

    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET)
      .update(body)
      .digest("hex");

    if (expectedSignature !== signature) {
      return { verified: false };
    }

    // 🔐 READ CURRENT ORDER STATE
    const order = await firestoreService.getOrderById(firestoreOrderId);

    // ✅ Already paid → ignore duplicate success
    if (order.status === 0) {
      return { verified: true, ignored: true };
    }

    // ✅ SUCCESS ALWAYS WINS
    await firestoreService.updateOrderStatus(firestoreOrderId, {
      status: 0, // paid
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

  async markPaymentFailed(firestoreOrderId, reason) {
    // 🔐 READ CURRENT ORDER STATE
    const order = await firestoreService.getOrderById(firestoreOrderId);

    // ❗ NEVER override a paid order
    if (order.status === 0) {
      return { ignored: true };
    }

    // ❗ Prevent duplicate failure writes
    if (order.status === 6) {
      return { ignored: true };
    }

    await firestoreService.updateOrderStatus(firestoreOrderId, {
      status: 6, // payment failed
      paymentVerified: false,
      paymentFailure: {
        reason,
        failedAt: new Date(),
      },
    });

    return { success: true };
  }
}

export default new RazorpayService();
