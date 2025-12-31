import BackendDatasource from "./BackendDatasource.js";
import { getDb } from "../../config/mongodb.js";

export default class MongoDatasource extends BackendDatasource {

  collection(name) {
    return getDb().collection(name);
  }

  // ---------- Generic CRUD ----------

  async queryCollection({ collection, where, orderBy, descending }) {
    const query = this._parseWhere(where);
    const sort = orderBy ? { [orderBy]: descending ? -1 : 1 } : {};

    return this.collection(collection)
      .find(query)
      .sort(sort)
      .toArray();
  }

  async queryCollectionPaginated({
    collection,
    where,
    orderBy,
    descending,
    limit,
    startAfter,
  }) {
    const query = this._parseWhere(where);

    if (startAfter && orderBy) {
      query[orderBy] = descending
        ? { $lt: startAfter }
        : { $gt: startAfter };
    }

    const cursor = this.collection(collection)
      .find(query)
      .sort(orderBy ? { [orderBy]: descending ? -1 : 1 } : {})
      .limit(limit || 20);

    const docs = await cursor.toArray();
    const lastDoc = docs.length ? docs[docs.length - 1][orderBy] : null;

    return { docs, cursor: lastDoc };
  }

  async getDocument({ collection, docId }) {
    return this.collection(collection).findOne({ _id: docId });
  }

  async setDocument({ collection, docId, data }) {
    await this.collection(collection).updateOne(
      { _id: docId },
      { $set: data },
      { upsert: true }
    );
  }

  async updateDocument({ collection, docId, data }) {
    await this.collection(collection).updateOne(
      { _id: docId },
      { $set: data }
    );
  }

  async deleteDocument({ collection, docId }) {
    await this.collection(collection).deleteOne({ _id: docId });
  }

  // ---------- Domain-specific ----------

  async getOrdersByDateRange(startDate, endDate) {
    return this.collection("OrderHistory")
      .find({
        createdAt: {
          $gte: startDate,
          $lte: endDate,
        },
        status: 4,
      })
      .toArray();
  }

  async getUsersByIds(userIds) {
    if (!userIds.length) return {};

    const users = await this.collection("users")
      .find({ uid: { $in: userIds } })
      .toArray();

    const map = {};
    for (const u of users) {
      map[u.uid] = u.name || "Unknown";
    }

    return map;
  }

  // ---------- Helpers ----------

  _parseWhere(where = {}) {
    const query = {};

    for (const key in where) {
      if (key.includes(">=")) {
        query[key.replace(">=", "").trim()] = { $gte: where[key] };
      } else if (key.includes("<=")) {
        query[key.replace("<=", "").trim()] = { $lte: where[key] };
      } else if (key.includes(">")) {
        query[key.replace(">", "").trim()] = { $gt: where[key] };
      } else if (key.includes("<")) {
        query[key.replace("<", "").trim()] = { $lt: where[key] };
      } else {
        query[key] = where[key];
      }
    }

    return query;
  }

    // 🔔 Admin FCM tokens
  async getAdminTokens() {
    const admins = await this.collection("users")
      .find({ type: 1, fcmToken: { $exists: true } })
      .toArray();

    return admins.map(a => a.fcmToken);
  }

  // 🔔 Customer token from order
  async getCustomerToken(orderId) {
    const order = await this.collection("OrderHistory")
      .findOne({ _id: orderId });

    return order?.fcm ?? null;
  }

  // 📦 Get order by ID
  async getOrderById(orderId) {
    const order = await this.collection("OrderHistory")
      .findOne({ _id: orderId });

    if (!order) {
      throw new Error("Order not found");
    }

    return order;
  }

  // 📦 Update order status (Razorpay etc.)
  async updateOrderStatus(orderId, updateData) {
    if (!orderId || !updateData) {
      throw new Error("orderId and updateData are required");
    }

    await this.collection("OrderHistory").updateOne(
      { _id: orderId },
      { $set: updateData }
    );
  }

}
