import FirestoreService from "../services/firestore.service.js";
import FCMService from "../services/fcm.service.js";


const ORDER_STATUS_MAP = {
  [-1]: "Not paid",
  0: "Paid not accepted",
  1: "Accepted",
  2: "In making",
  3: "Ready to pick",
  4: "Picked up",
  5: "Cancelled",
  6: "Payment failed",
};

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
      if (!token) {
        return res.json({ success: false, message: "No customer token" });
      }

      // Convert numeric status → human readable
      const readableStatus =
        ORDER_STATUS_MAP[status] ?? "Order updated";

      await FCMService.sendNotificationToTokens(
        [token],
        "Order Update",
        `Your order is now ${readableStatus}`,
        {
          orderId,
          status,
          readableStatus, // useful for client-side handling/logging
        }
      );

      res.json({ success: true });
    } catch (err) {
      console.error("sendOrderStatus error:", err);
      res.status(500).json({ success: false });
    }
  }

}

export default new NotificationController();
