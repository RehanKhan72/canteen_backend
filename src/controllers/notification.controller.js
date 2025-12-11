import FirestoreService from "../services/firestore.service.js";
import FCMService from "../services/fcm.service.js";

class NotificationController {

  // For new orders → notify admins
  async sendNewOrder(req, res) {
    try {
      const { orderId, summary } = req.body;

      const tokens = await FirestoreService.getAdminTokens();

      await FCMService.sendNotificationToTokens(
        tokens,
        "New Order Received",
        `Order #${orderId} is placed`,
        { orderId }
      );

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false, message: "Server error" });
    }
  }

  // For status updates → notify customer
  async sendOrderStatus(req, res) {
    try {
      const { orderId, status } = req.body;

      const token = await FirestoreService.getCustomerToken(orderId);
      if (!token) return res.json({ success: false, message: "No customer token" });

      await FCMService.sendNotificationToTokens(
        [token],
        "Order Update",
        `Your order is now ${status}`,
        { orderId, status }
      );

      res.json({ success: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ success: false });
    }
  }
}

export default new NotificationController();
