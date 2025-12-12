import admin from "../config/firebase.js";

const db = admin.firestore();

class FirestoreService {
  // ⬇️ Get all admins' FCM tokens
  async getAdminTokens() {
    const snapshot = await db
      .collection("users")
      .where("type", "==", 1)
      .get();

    let tokens = [];

    snapshot.forEach((doc) => {
      const data = doc.data();
      if (data.fcmToken) {
        tokens.push(data.fcmToken);
      }
    });

    return tokens;
  }

  // ⬇️ Get a specific user's FCM token (customer)
  async getCustomerToken(orderId) {
  // Read the Order document
  const orderDoc = await db.collection("OrderHistory").doc(orderId).get();

  if (!orderDoc.exists) return null;

  const data = orderDoc.data();
  console.log("ORDER DATA:", data);

  // FCM field from order
  return data.fcm ?? null;
}

}

export default new FirestoreService();
