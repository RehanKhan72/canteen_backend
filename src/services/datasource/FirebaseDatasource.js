import BackendDatasource from "./BackendDatasource.js";
import OrderModel from "../../models/OrderModel.js";
import { db } from "../../config/firebase.js";

export default class FirebaseDatasource extends BackendDatasource {
  async getOrdersByDateRange(startDate, endDate) {
    const snapshot = await db
      .collection("OrderHistory")
      .where("createdAt", ">=", startDate)
      .where("createdAt", "<=", endDate)
      .where("status", "==", 4)
      .get();

    return snapshot.docs.map(doc =>
      new OrderModel(doc.data(), doc.id)
    );
  }

  async getUsersByIds(userIds) {
    if (!userIds.length) return {};

    const chunks = [];
    while (userIds.length) {
      chunks.push(userIds.splice(0, 10)); // Firestore where-in limit
    }

    const userMap = {};

    for (const chunk of chunks) {
      const snapshot = await db
        .collection("users")
        .where("uid", "in", chunk)
        .get();

      snapshot.forEach(doc => {
        const data = doc.data();
        userMap[data.uid] = data.name || "Unknown";
      });
    }

    return userMap;
  }
}
