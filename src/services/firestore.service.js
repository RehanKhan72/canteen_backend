import { db } from "../config/firebase.js";

class FirestoreService {
  // ⬇️ Get all admins' FCM tokens
  async getAdminTokens() {
    const snapshot = await db
      .collection("users")
      .where("type", "==", 1)
      .get();

    const tokens = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.fcmToken) {
        tokens.push(data.fcmToken);
      }
    });

    return tokens;
  }

  // ⬇️ Get a specific customer's FCM token
  async getCustomerToken(orderId) {
    const orderDoc = await db
      .collection("OrderHistory")
      .doc(orderId)
      .get();

    if (!orderDoc.exists) return null;

    const data = orderDoc.data();
    return data?.fcm ?? null;
  }

    // ⬇️ Update order status safely (used by Razorpay)
  async updateOrderStatus(orderId, updateData) {
    if (!orderId || !updateData) {
      throw new Error("orderId and updateData are required");
    }

    await db
      .collection("OrderHistory")
      .doc(orderId)
      .update(updateData);
  }

}

export default new FirestoreService();
