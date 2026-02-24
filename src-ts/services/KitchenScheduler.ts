// src/services/KitchenScheduler.ts

import { getDb } from "../config/mongodb.js";
import KitchenService from "./KitchenService.js";
import { emitKitchenUpdate } from "../socket/SocketGateway.js";
import FCMService from "../../src/services/fcm.service.js";
import MongoDatasource from "../services/datasource/MongoDatasource.js";

const ds = new MongoDatasource();

export default class KitchenScheduler {

  static async ensureIndexes() {
    const db = getDb();
    await db.collection("OrderHistory").createIndex(
      { status: 1, kitchenScheduledAt: 1 }
    );
    console.log("✅ Scheduler index ensured");
  }

  static start() {

    this.ensureIndexes(); // 🔥 ensure index on startup

    setInterval(async () => {

      const db = getDb();
      const ordersCollection = db.collection("OrderHistory");

      const now = Date.now();

      // 🔥 Atomically update and fetch updated docs
      const updatedOrders = await ordersCollection.find({
        status: 1,
        kitchenScheduledAt: { $lte: now }
      }).toArray();

      for (const order of updatedOrders) {

        const updateResult = await ordersCollection.updateOne(
          {
            _id: order._id,
            status: 1
          },
          {
            $set: {
              status: 2,
              updatedAt: Date.now()
            }
          }
        );

        // Only proceed if status was actually changed
        if (updateResult.modifiedCount === 0) continue;

        // 🔥 Add to kitchen
        await KitchenService.addOrderItems(order);

        // 🔔 Notify user
        try {
          const token = await ds.getCustomerToken(order._id);

          if (token) {
            await FCMService.sendNotificationToTokens(
              [token],
              "Order Update",
              "Your order is now being prepared",
              {
                orderId: order._id,
                status: 2
              }
            );
          }
        } catch (err) {
          console.error("Scheduler notification failed:", err);
        }
      }

      if (updatedOrders.length > 0) {
        const snapshot = await KitchenService.getSnapshot();
        emitKitchenUpdate(snapshot);
      }

    }, 30000);
  }
}