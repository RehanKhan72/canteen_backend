import BackendDatasource from "./BackendDatasource.js";
import OrderModel from "../../models/OrderModel.js";
import db from "../../config/firebase.js";

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
}
