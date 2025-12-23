const BackendDatasource = require("./BackendDatasource");
const OrderModel = require("../../models/OrderModel");
const db = require("../../config/firebase");

class FirebaseDatasource extends BackendDatasource {
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

module.exports = FirebaseDatasource;
