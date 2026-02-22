// src/services/KitchenScheduler.ts
import { getDb } from "../config/mongodb.js";
import KitchenService from "./KitchenService.js";
import { emitKitchenUpdate } from "../socket/SocketGateway.js";
export default class KitchenScheduler {
    static start() {
        setInterval(async () => {
            const db = getDb();
            const ordersCollection = db.collection("OrderHistory");
            const now = Date.now();
            const readyOrders = await ordersCollection.find({
                status: 1,
                kitchenScheduledAt: { $lte: now }
            }).toArray();
            for (const order of readyOrders) {
                const result = await ordersCollection.findOneAndUpdate({
                    _id: order._id,
                    status: 1
                }, {
                    $set: { status: 2, updatedAt: Date.now() }
                }, { returnDocument: "after" });
                if (!result || !result.value)
                    continue;
                await KitchenService.addOrderItems(result.value);
            }
            if (readyOrders.length > 0) {
                const snapshot = await KitchenService.getSnapshot();
                emitKitchenUpdate(snapshot);
            }
        }, 30000); // every 30 sec
    }
}
