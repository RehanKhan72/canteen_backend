import admin from "../config/firebase.js";

const db = admin.firestore();

class FirestoreService {
  async getAdminTokens() {
    const snapshot = await db.collection("Admins").get();
    let tokens = [];

    snapshot.forEach(doc => {
      const data = doc.data();
      if (data.deviceTokens) tokens.push(...data.deviceTokens);
    });

    return tokens;
  }

  async getCustomerToken(orderId) {
    const orderDoc = await db.collection("Orders").doc(orderId).get();
    if (!orderDoc.exists) return null;

    return orderDoc.data().customerFcmToken ?? null;
  }
}

export default new FirestoreService();
