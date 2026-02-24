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

  async cancelAndRefund(orderId) {

    const order = await ds.getOrderById(orderId);

    if (!order) {
      throw new Error("Order not found");
    }

    if (order.status === 5) {
      return { skipped: true, reason: "Already cancelled" };
    }

    // Update status to cancelled first
    await ds.updateOrderStatus(orderId, {
      status: 5,
      updatedAt: Date.now(),
    });

    // If payment not verified → no refund needed
    if (!order.paymentVerified) {
      return { cancelled: true, refund: "NOT_REQUIRED" };
    }

    // Prevent double refund
    if (order.refundStatus && order.refundStatus !== "NONE") {
      return { cancelled: true, refund: "ALREADY_PROCESSED" };
    }

    // Mark refund processing
    await ds.updateOrderStatus(orderId, {
      refundStatus: "PROCESSING",
      refundInitiatedAt: Date.now(),
    });

    try {
      const refund = await razorpayInstance.payments.refund(
        order.paymentDetails.paymentId,
        {
          amount: order.amount * 100,
        }
      );

      await ds.updateOrderStatus(orderId, {
        refundStatus: "SUCCESS",
        refundId: refund.id,
        refundedAt: Date.now(),
      });

      return {
        cancelled: true,
        refund: "SUCCESS",
        refundId: refund.id,
      };

    } catch (error) {

      await ds.updateOrderStatus(orderId, {
        refundStatus: "FAILED",
        refundFailure: {
          message: error.message,
          failedAt: Date.now(),
        },
      });

      return {
        cancelled: true,
        refund: "FAILED",
      };
    }
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

    // Prevent double processing
    if (order.status !== -1) {
      return { verified: true, ignored: true };
    }

    const now = Date.now();

    // ==============================
    // 🚀 CASE 1: PICKUP NOW
    // ==============================
    if (order.pickupMode === "now") {

      await ds.updateOrderStatus(firestoreOrderId, {
        status: 2, // or 1 in later case
        paymentVerified: true,
        paymentStatus: "SUCCESS",
        razorpayPaymentId: paymentId,
        refundStatus: "NONE", // 🔥 important
        paymentDetails: {
          orderId,
          paymentId,
          signature,
          verifiedAt: now,
        },
        updatedAt: now,
      });

      const updatedOrder = await ds.getOrderById(firestoreOrderId);

      await KitchenService.addOrderItems(updatedOrder);

      const snapshot = await KitchenService.getSnapshot();
      emitKitchenUpdate(snapshot);

      return { verified: true };
    }

    // ==============================
    // 🕒 CASE 2: PICKUP LATER
    // ==============================
    if (order.pickupMode === "later") {

      const pickupTimestamp = order.pickupTime; // 🔥 already epoch

      if (!pickupTimestamp || typeof pickupTimestamp !== "number") {
        console.error("Invalid pickupTime:", order.pickupTime);
        return { verified: false };
      }

      const scheduledTime = pickupTimestamp - (15 * 60 * 1000);

      await ds.updateOrderStatus(firestoreOrderId, {
        status: 1,
        paymentVerified: true,
        paymentStatus: "SUCCESS",
        razorpayPaymentId: paymentId,
        refundStatus: "NONE",
        kitchenScheduledAt: scheduledTime,
        paymentDetails: {
          orderId,
          paymentId,
          signature,
          verifiedAt: now,
        },
        updatedAt: now,
      });

      // If already inside the 15-minute window
      if (scheduledTime <= now) {

        await ds.updateOrderStatus(firestoreOrderId, {
          status: 2,
          updatedAt: now,
        });

        const updatedOrder = await ds.getOrderById(firestoreOrderId);

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
