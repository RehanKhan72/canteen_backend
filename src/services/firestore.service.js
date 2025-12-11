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
  async getCustomerToken(uid) {
    const userDoc = await db.collection("users").doc(uid).get();

    if (!userDoc.exists) return null;

    const data = userDoc.data();
    return data.fcmToken ?? null;
  }
}

export default new FirestoreService();
