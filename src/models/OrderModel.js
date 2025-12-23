import OrderItem from "./OrderItem.js";

export default class OrderModel {
  constructor(raw, docId) {
    this.orderId = raw.orderId || "";
    this.docId = docId;
    this.fcm = raw.fcm || "";
    this.userUid = raw.userUid || "";
    this.overallTotal = Number(raw.overallTotal || 0);
    this.paymentMode = raw.paymentMode || "";
    this.status = raw.status || 0;
    this.createdAt = raw.createdAt?.toDate
      ? raw.createdAt.toDate()
      : new Date(raw.createdAt);
    this.notes = raw.notes || null;
    this.isPaymentStatus = raw.isPaymentStatus || false;
    this.pickupMode = raw.pickupMode || "now";
    this.pickupTime = raw.pickupTime || null;

    this.items = Array.isArray(raw.items)
      ? raw.items.map(i => new OrderItem(i))
      : [];
  }
}
