// src/services/razorpay.service.js
import crypto from "crypto";
import razorpayInstance from "../config/razorpay.js";
import MongoDatasource from "./datasource/MongoDatasource.js";

import KitchenService from "../../dist/services/KitchenService.js";
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

    const order = await ds.getOrderById(firestoreOrderId);

    if (order.status !== -1) {
      return { verified: true, ignored: true };
    }

    const now = Date.now();

    // 🔥 CASE 1: PICKUP NOW
    if (order.pickupMode === "now") {

      await ds.updateOrderStatus(firestoreOrderId, {
        status: 2,
        paymentVerified: true,
        paymentDetails: {
          orderId,
          paymentId,
          signature,
          verifiedAt: now,
        },
        updatedAt: now,
      });

      // 🔥 ADD THIS
      const updatedOrder = await ds.getOrderById(firestoreOrderId);

      await KitchenService.addOrderItems(updatedOrder);

      const snapshot = await KitchenService.getSnapshot();
      emitKitchenUpdate(snapshot);

      return { verified: true };
    }

    // 🔥 CASE 2: PICKUP LATER (dynamic format support)
    if (order.pickupMode === "later") {

      let pickupTimestamp = null;

      // ✅ If already epoch number
      if (typeof order.pickupTime === "number") {
        pickupTimestamp = order.pickupTime;
      }

      // ✅ If string (HH:mm or ISO)
      else if (typeof order.pickupTime === "string") {

        if (order.pickupTime.includes(":") && order.pickupTime.length <= 5) {
          // Format: "HH:mm"
          const [hours, minutes] = order.pickupTime.split(":");

          const d = new Date();
          d.setHours(parseInt(hours));
          d.setMinutes(parseInt(minutes));
          d.setSeconds(0);
          d.setMilliseconds(0);

          pickupTimestamp = d.getTime();
        } else {
          // Try ISO parsing
          const parsed = new Date(order.pickupTime);
          if (!isNaN(parsed.getTime())) {
            pickupTimestamp = parsed.getTime();
          }
        }
      }

      if (!pickupTimestamp) {
        console.error("Invalid pickupTime format:", order.pickupTime);
        return { verified: false };
      }

      const scheduledTime = pickupTimestamp - (15 * 60 * 1000);

      await ds.updateOrderStatus(firestoreOrderId, {
        status: 1,
        paymentVerified: true,
        kitchenScheduledAt: scheduledTime,
        paymentDetails: {
          orderId,
          paymentId,
          signature,
          verifiedAt: now,
        },
        updatedAt: now,
      });

      // If already within 15-minute window
      if (scheduledTime <= now) {

        const updatedOrder = await ds.getOrderById(firestoreOrderId);

        await ds.updateOrderStatus(firestoreOrderId, {
          status: 2,
          updatedAt: now,
        });

        await KitchenService.addOrderItems(updatedOrder);

        const snapshot = await KitchenService.getSnapshot();
        emitKitchenUpdate(snapshot);
      }

      return { verified: true };
    }

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
