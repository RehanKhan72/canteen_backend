// src-ts/services/hdfc.service.ts
// HDFC Collect Now payment service.
// Preserves existing order-status semantics and OrderHistory field usage.
// Supports: order creation, signature verification, status inquiry,
//           webhook processing, refunds, and crash recovery.

import crypto from "crypto";
import hdfcInstance from "../config/hdfc.js";
import MongoDatasource from "../../src/services/datasource/MongoDatasource.js";
import KitchenService from "./KitchenService.js";
import { emitKitchenUpdate } from "../socket/SocketGateway.js";

const ds = new MongoDatasource();

// Payment status constants (normalised internally)
type PaymentResult = "SUCCESS" | "FAILED" | "PENDING";

class HdfcService {
  // ================================================================
  // PHASE 1 — Order creation
  // ================================================================

  async createOrder(amount: number, receiptId: string) {
    return hdfcInstance.orders.create({
      amount: amount * 100, // rupees → paise
      currency: "INR",
      receipt: receiptId,
    });
  }

  // ================================================================
  // PHASE 2 — Signature verification + order update
  // ================================================================

  async verifyPayment({
    orderId,
    paymentId,
    signature,
    firestoreOrderId,
  }: {
    orderId: string;
    paymentId: string;
    signature: string;
    firestoreOrderId: string;
  }) {
    // --- HMAC-SHA256 signature check ---
    const body = `${orderId}|${paymentId}`;
    const expectedSignature = crypto
      .createHmac("sha256", process.env.RAZORPAY_SECRET as string)
      .update(body)
      .digest("hex");

    if (expectedSignature !== signature) {
      return { verified: false };
    }

    // --- Fetch order from MongoDB ---
    const order = await ds.getOrderById(firestoreOrderId);

    // Idempotency: skip if already processed (status !== -1)
    if (order.status !== -1) {
      return { verified: true, ignored: true };
    }

    const now = Date.now();

    // --- CASE 1: PICKUP NOW ---
    if (order.pickupMode === "now") {
      await ds.updateOrderStatus(firestoreOrderId, {
        status: 2,
        paymentVerified: true,
        paymentStatus: "SUCCESS",
        razorpayPaymentId: paymentId,
        refundStatus: "NONE",
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

    // --- CASE 2: PICKUP LATER ---
    if (order.pickupMode === "later") {
      const pickupTimestamp = order.pickupTime;

      if (!pickupTimestamp || typeof pickupTimestamp !== "number") {
        console.error("Invalid pickupTime:", order.pickupTime);
        return { verified: false };
      }

      const scheduledTime = pickupTimestamp - 15 * 60 * 1000;

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

      // If already inside the 15-minute window, promote immediately
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

  // ================================================================
  // PHASE 3 — Payment status inquiry (dual inquiry / reconciliation)
  // ================================================================

  /**
   * Query the HDFC/Razorpay API for the actual payment state.
   * Normalises the result into SUCCESS / FAILED / PENDING.
   * Only "captured" is treated as SUCCESS.
   */
  async queryPaymentStatus(paymentId: string): Promise<{
    status: PaymentResult;
    raw?: any;
  }> {
    try {
      const payment = await hdfcInstance.payments.fetch(paymentId);

      if (payment.status === "captured") {
        return { status: "SUCCESS", raw: payment };
      }

      if (
        payment.status === "failed" ||
        payment.status === "cancelled" ||
        payment.status === "refunded"
      ) {
        return { status: "FAILED", raw: payment };
      }

      // created, authorized, or any other intermediate state
      return { status: "PENDING", raw: payment };
    } catch (error: any) {
      console.error("Payment status query failed:", error);
      return { status: "PENDING" };
    }
  }

  /**
   * Fetch order-level status from HDFC/Razorpay.
   */
  async queryOrderStatus(orderId: string): Promise<{
    status: PaymentResult;
    raw?: any;
  }> {
    try {
      const order = await hdfcInstance.orders.fetch(orderId);

      if (order.status === "paid") {
        return { status: "SUCCESS", raw: order };
      }

      if (order.status === "failed") {
        return { status: "FAILED", raw: order };
      }

      return { status: "PENDING", raw: order };
    } catch (error: any) {
      console.error("Order status query failed:", error);
      return { status: "PENDING" };
    }
  }

  /**
   * Full reconciliation: given a Firestore order ID, find the linked
   * Razorpay payment/order and determine the actual status.
   * Used by Flutter-side recovery and manual reconciliation.
   */
  async reconcileOrder(firestoreOrderId: string) {
    const order = await ds.getOrderById(firestoreOrderId);

    // If already in a terminal state, no reconciliation needed
    if (
      order.status === 0 ||
      order.status === 2 ||
      order.status === 3 ||
      order.status === 4 ||
      order.status === 5 ||
      order.status === 6
    ) {
      return {
        reconciled: true,
        orderStatus: order.status,
        paymentStatus: order.paymentStatus || null,
        action: "NONE",
      };
    }

    // status === -1 (not paid) — try to determine actual state
    const paymentId =
      order.razorpayPaymentId || order.paymentDetails?.paymentId;
    const gatewayOrderId =
      order.paymentDetails?.orderId || order.orderId;

    let result: PaymentResult = "PENDING";

    if (paymentId) {
      const query = await this.queryPaymentStatus(paymentId);
      result = query.status;
    } else if (gatewayOrderId) {
      const query = await this.queryOrderStatus(gatewayOrderId);
      result = query.status;
    }

    if (result === "SUCCESS") {
      // Status API confirmed payment is captured — update order directly.
      // We do NOT re-verify the HMAC signature here since this is a
      // server-initiated reconciliation, not a client callback.
      const now = Date.now();

      if (order.pickupMode === "now") {
        await ds.updateOrderStatus(firestoreOrderId, {
          status: 2,
          paymentVerified: true,
          paymentStatus: "SUCCESS",
          razorpayPaymentId: paymentId || "",
          refundStatus: "NONE",
          paymentDetails: {
            orderId: gatewayOrderId || "",
            paymentId: paymentId || "",
            signature: "reconciliation",
            verifiedAt: now,
          },
          updatedAt: now,
        });

        const updatedOrder = await ds.getOrderById(firestoreOrderId);
        await KitchenService.addOrderItems(updatedOrder);
        const snapshot = await KitchenService.getSnapshot();
        emitKitchenUpdate(snapshot);
      } else if (order.pickupMode === "later") {
        const pickupTimestamp = order.pickupTime;
        if (pickupTimestamp && typeof pickupTimestamp === "number") {
          const scheduledTime = pickupTimestamp - 15 * 60 * 1000;

          await ds.updateOrderStatus(firestoreOrderId, {
            status: 1,
            paymentVerified: true,
            paymentStatus: "SUCCESS",
            razorpayPaymentId: paymentId || "",
            refundStatus: "NONE",
            kitchenScheduledAt: scheduledTime,
            paymentDetails: {
              orderId: gatewayOrderId || "",
              paymentId: paymentId || "",
              signature: "reconciliation",
              verifiedAt: now,
            },
            updatedAt: now,
          });

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
        }
      }

      return {
        reconciled: true,
        orderStatus: 2,
        paymentStatus: "SUCCESS",
        action: "UPDATED",
      };
    }

    if (result === "FAILED") {
      await this.markPaymentFailed(firestoreOrderId, "reconciliation_failed");
      return {
        reconciled: true,
        orderStatus: 6,
        paymentStatus: "FAILED",
        action: "UPDATED",
      };
    }

    return {
      reconciled: false,
      orderStatus: order.status,
      paymentStatus: null,
      action: "PENDING",
    };
  }

  // ================================================================
  // PHASE 4 — Webhook event processing (idempotent)
  // ================================================================

  async handleWebhookEvent(event: any) {
    const eventType = event.event || event.payload?.payment?.entity?.event;

    if (!eventType) {
      return { processed: false, reason: "unknown_event" };
    }

    switch (eventType) {
      case "payment.captured":
        return this.handlePaymentCaptured(event);

      case "payment.failed":
        return this.handlePaymentFailed(event);

      case "payment.authorized":
        return this.handlePaymentAuthorized(event);

      case "order.paid":
        return this.handleOrderPaid(event);

      case "refund.created":
      case "refund.processed":
      case "refund.failed":
        return this.handleRefundEvent(event);

      default:
        return { processed: false, reason: `unhandled_event: ${eventType}` };
    }
  }

  // --- payment.captured ---
  private async handlePaymentCaptured(event: any) {
    const payment = event.payload?.payment?.entity;
    if (!payment) return { processed: false, reason: "missing_payment_entity" };

    const razorpayOrderId = payment.order_id;
    const razorpayPaymentId = payment.id;

    // Find order by paymentDetails.orderId or razorpayPaymentId
    const order = await this.findOrderForPayment(
      razorpayOrderId,
      razorpayPaymentId
    );
    if (!order) return { processed: false, reason: "order_not_found" };

    // Idempotency: already paid or cancelled
    if (order.status !== -1) {
      return { processed: true, reason: "already_processed" };
    }

    // Enforce: only captured is successful
    if (payment.status !== "captured") {
      return { processed: true, reason: "not_captured" };
    }

    const now = Date.now();

    if (order.pickupMode === "now") {
      await ds.updateOrderStatus(order._id, {
        status: 2,
        paymentVerified: true,
        paymentStatus: "SUCCESS",
        razorpayPaymentId: razorpayPaymentId,
        refundStatus: "NONE",
        paymentDetails: {
          orderId: razorpayOrderId,
          paymentId: razorpayPaymentId,
          signature: "webhook",
          verifiedAt: now,
        },
        updatedAt: now,
      });

      const updatedOrder = await ds.getOrderById(order._id);
      await KitchenService.addOrderItems(updatedOrder);
      const snapshot = await KitchenService.getSnapshot();
      emitKitchenUpdate(snapshot);
    } else if (order.pickupMode === "later") {
      const pickupTimestamp = order.pickupTime;
      if (pickupTimestamp && typeof pickupTimestamp === "number") {
        const scheduledTime = pickupTimestamp - 15 * 60 * 1000;

        await ds.updateOrderStatus(order._id, {
          status: 1,
          paymentVerified: true,
          paymentStatus: "SUCCESS",
          razorpayPaymentId: razorpayPaymentId,
          refundStatus: "NONE",
          kitchenScheduledAt: scheduledTime,
          paymentDetails: {
            orderId: razorpayOrderId,
            paymentId: razorpayPaymentId,
            signature: "webhook",
            verifiedAt: now,
          },
          updatedAt: now,
        });

        if (scheduledTime <= now) {
          await ds.updateOrderStatus(order._id, {
            status: 2,
            updatedAt: now,
          });
          const updatedOrder = await ds.getOrderById(order._id);
          await KitchenService.addOrderItems(updatedOrder);
          const snapshot = await KitchenService.getSnapshot();
          emitKitchenUpdate(snapshot);
        }
      }
    }

    return { processed: true };
  }

  // --- payment.failed ---
  private async handlePaymentFailed(event: any) {
    const payment = event.payload?.payment?.entity;
    if (!payment) return { processed: false, reason: "missing_payment_entity" };

    const razorpayOrderId = payment.order_id;
    const razorpayPaymentId = payment.id;

    const order = await this.findOrderForPayment(
      razorpayOrderId,
      razorpayPaymentId
    );
    if (!order) return { processed: false, reason: "order_not_found" };

    // Idempotency: already cancelled or failed
    if (order.status === 5 || order.status === 6) {
      return { processed: true, reason: "already_processed" };
    }

    await ds.updateOrderStatus(order._id, {
      status: 6,
      paymentVerified: false,
      paymentFailure: {
        reason: payment.error_description || "payment_failed",
        failedAt: Date.now(),
      },
      updatedAt: Date.now(),
    });

    return { processed: true };
  }

  // --- payment.authorized (intermediate — do NOT mark as paid) ---
  private async handlePaymentAuthorized(event: any) {
    const payment = event.payload?.payment?.entity;
    if (!payment) return { processed: false, reason: "missing_payment_entity" };

    const order = await this.findOrderForPayment(
      payment.order_id,
      payment.id
    );
    if (!order) return { processed: false, reason: "order_not_found" };

    // Do NOT mark as paid — only captured is successful
    // Record the authorization for audit purposes
    if (order.status === -1) {
      await ds.updateOrderStatus(order._id, {
        paymentAuthAt: Date.now(),
        paymentAuthDetails: {
          paymentId: payment.id,
          orderId: payment.order_id,
          amount: payment.amount,
        },
        updatedAt: Date.now(),
      });
    }

    return { processed: true, note: "authorized_not_captured" };
  }

  // --- order.paid ---
  private async handleOrderPaid(event: any) {
    const orderEntity = event.payload?.order?.entity;
    if (!orderEntity)
      return { processed: false, reason: "missing_order_entity" };

    const razorpayOrderId = orderEntity.id;

    const order = await this.findOrderForGatewayOrder(razorpayOrderId);
    if (!order) return { processed: false, reason: "order_not_found" };

    // Idempotency
    if (order.status !== -1) {
      return { processed: true, reason: "already_processed" };
    }

    // Only treat as successful if the order is marked as paid
    // This is a secondary check — payment.captured is the primary
    if (orderEntity.status === "paid") {
      // Delegate to payment.captured logic if we have a payment ID
      // Otherwise, mark directly
      const paymentId = order.razorpayPaymentId || order.paymentDetails?.paymentId;
      if (paymentId) {
        return this.handlePaymentCaptured({
          payload: {
            payment: {
              entity: {
                id: paymentId,
                order_id: razorpayOrderId,
                status: "captured",
              },
            },
          },
        });
      }
    }

    return { processed: true, note: "order_paid_event_recorded" };
  }

  // --- refund events ---
  private async handleRefundEvent(event: any) {
    const refund = event.payload?.refund?.entity;
    if (!refund) return { processed: false, reason: "missing_refund_entity" };

    const order = await this.findOrderForPayment(
      refund.payment_id,
      refund.id
    );
    if (!order) return { processed: false, reason: "order_not_found" };

    const eventType = event.event;

    if (eventType === "refund.created" || eventType === "refund.processed") {
      // Idempotency: don't overwrite SUCCESS
      if (order.refundStatus === "SUCCESS") {
        return { processed: true, reason: "already_processed" };
      }

      await ds.updateOrderStatus(order._id, {
        refundStatus: "SUCCESS",
        refundId: refund.id,
        refundedAt: Date.now(),
        updatedAt: Date.now(),
      });
    }

    if (eventType === "refund.failed") {
      if (order.refundStatus === "SUCCESS") {
        return { processed: true, reason: "already_processed" };
      }

      await ds.updateOrderStatus(order._id, {
        refundStatus: "FAILED",
        refundFailure: {
          message: refund.error_description || "refund_failed",
          failedAt: Date.now(),
        },
        updatedAt: Date.now(),
      });
    }

    return { processed: true };
  }

  // ================================================================
  // PHASE 5 — Payment failure marking
  // ================================================================

  async markPaymentFailed(firestoreOrderId: string, reason: string) {
    const order = await ds.getOrderById(firestoreOrderId);

    // Never override a paid order
    if (order.status === 0) return { ignored: true };

    // Prevent duplicate failure writes
    if (order.status === 6) return { ignored: true };

    await ds.updateOrderStatus(firestoreOrderId, {
      status: 6,
      paymentVerified: false,
      paymentFailure: {
        reason,
        failedAt: Date.now(),
      },
      updatedAt: Date.now(),
    });

    return { success: true };
  }

  // ================================================================
  // PHASE 6 — Refund / cancellation
  // ================================================================

  async cancelAndRefund(orderId: string) {
    const order = await ds.getOrderById(orderId);

    if (!order) throw new Error("Order not found");

    if (order.status === 5) {
      return { skipped: true, reason: "Already cancelled" };
    }

    // Cancel first
    await ds.updateOrderStatus(orderId, {
      status: 5,
      updatedAt: Date.now(),
    });

    // No refund needed if payment was never verified
    if (!order.paymentVerified) {
      return { cancelled: true, refund: "NOT_REQUIRED" };
    }

    // Prevent double refund
    if (order.refundStatus && order.refundStatus !== "NONE") {
      return { cancelled: true, refund: "ALREADY_PROCESSED" };
    }

    // Mark refund as processing
    await ds.updateOrderStatus(orderId, {
      refundStatus: "PROCESSING",
      refundInitiatedAt: Date.now(),
    });

    try {
      const refund = await hdfcInstance.payments.refund(
        order.paymentDetails.paymentId,
        { amount: order.overallTotal * 100 }
      );

      await ds.updateOrderStatus(orderId, {
        refundStatus: "SUCCESS",
        refundId: refund.id,
        refundedAt: Date.now(),
      });

      return { cancelled: true, refund: "SUCCESS", refundId: refund.id };
    } catch (error: any) {
      console.log("Refund Error:", error);

      await ds.updateOrderStatus(orderId, {
        refundStatus: "FAILED",
        refundFailure: {
          message: error?.error?.description || error.message,
          failedAt: Date.now(),
        },
      });

      return { cancelled: true, refund: "FAILED" };
    }
  }

  // ================================================================
  // Internal helpers
  // ================================================================

  /**
   * Find an OrderHistory document by Razorpay order ID or payment ID.
   * Searches paymentDetails.orderId, paymentDetails.paymentId, and
   * razorpayPaymentId fields.
   */
  private async findOrderForPayment(
    razorpayOrderId: string,
    razorpayPaymentId: string
  ): Promise<any> {
    const { getDb } = await import("../config/mongodb.js");
    const db = getDb();
    const col = db.collection("OrderHistory");

    // Try paymentDetails.orderId first
    let order = await col.findOne({ "paymentDetails.orderId": razorpayOrderId });
    if (order) return order;

    // Try razorpayPaymentId field
    order = await col.findOne({ razorpayPaymentId: razorpayPaymentId });
    if (order) return order;

    // Try paymentDetails.paymentId
    order = await col.findOne({ "paymentDetails.paymentId": razorpayPaymentId });
    return order;
  }

  /**
   * Find an OrderHistory document by Razorpay order ID only.
   */
  private async findOrderForGatewayOrder(
    razorpayOrderId: string
  ): Promise<any> {
    const { getDb } = await import("../config/mongodb.js");
    const db = getDb();
    const col = db.collection("OrderHistory");

    let order = await col.findOne({ "paymentDetails.orderId": razorpayOrderId });
    if (order) return order;

    // Fallback: check if the order field matches
    order = await col.findOne({ orderId: razorpayOrderId });
    return order;
  }
}

export default new HdfcService();
