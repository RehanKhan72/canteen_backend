import admin from "../config/firebase.js";

class FCMService {
  async sendNotificationToTokens(tokens, title, body, data = {}) {
    if (!tokens || tokens.length === 0) return;

    const message = {
      notification: { title, body },
      tokens: tokens,
      data: data,
    };

    try {
      const response = await admin.messaging().sendMulticast(message);
      console.log("FCM sent:", response.successCount);
    } catch (err) {
      console.error("FCM Error:", err);
    }
  }
}

export default new FCMService();
