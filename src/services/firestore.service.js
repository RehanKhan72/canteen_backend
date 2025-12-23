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
}

export default new FirestoreService();
