// src/services/razorpay.service.js
import crypto from "crypto";
import razorpayInstance from "../config/razorpay.js";
import MongoDatasource from "./datasource/MongoDatasource.js";
import { emitKitchenUpdate } from "../../dist/socket/SocketGateway.js";

const ds = new MongoDatasource();

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

    // 🔐 READ CURRENT ORDER (Mongo)
    const order = await ds.getOrderById(firestoreOrderId);

    // ✅ Already paid → ignore duplicate success
    if (order.status === 0) {
      return { verified: true, ignored: true };
    }

    // ✅ SUCCESS ALWAYS WINS
    await ds.updateOrderStatus(firestoreOrderId, {
      status: 2, // In making
      paymentVerified: true,
      paymentDetails: {
        orderId,
        paymentId,
        signature,
        verifiedAt: Date.now(),
      },
    });

    // 🔥 ADD THIS
    const updatedOrder = await ds.getOrderById(firestoreOrderId);
    await KitchenService.addOrderItems(updatedOrder);

    const snapshot = await KitchenService.getSnapshot();
    emitKitchenUpdate(snapshot);


    return { verified: true };
  }

  async markPaymentFailed(firestoreOrderId, reason) {
    // 🔐 READ CURRENT ORDER (Mongo)
    const order = await ds.getOrderById(firestoreOrderId);

    // ❗ NEVER override a paid order
    if (order.status === 0) {
      return { ignored: true };
    }

    // ❗ Prevent duplicate failure writes
    if (order.status === 6) {
      return { ignored: true };
    }

    await ds.updateOrderStatus(firestoreOrderId, {
      status: 6, // payment failed
      paymentVerified: false,
      paymentFailure: {
        reason,
        failedAt: Date.now(),
      },
    });

    return { success: true };
  }
}

export default new RazorpayService();
