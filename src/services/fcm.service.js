import admin from "../config/firebase.js";

class FCMService {
  async sendNotificationToTokens(tokens, title, body, data = {}) {
    if (!tokens || tokens.length === 0) {
      console.log("❌ No tokens to send notification");
      return;
    }

    // Firebase requires all data fields to be strings
    const stringData = {};
    Object.keys(data).forEach(key => {
      stringData[key] = String(data[key]);
    });

    const message = {
      notification: {
        title,
        body,
      },
      data: stringData,
      tokens: tokens,
    };

    try {
      const response = await admin.messaging().sendEachForMulticast(message);
      console.log(`FCM sent => success: ${response.successCount}, failed: ${response.failureCount}`);
    } catch (err) {
      console.error("🔥 FCM Error:", err);
    }
  }
}

export default new FCMService();
