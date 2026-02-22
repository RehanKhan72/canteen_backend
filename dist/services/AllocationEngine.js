// src/services/AllocationEngine.ts
import { getDb } from "../config/mongodb.js";
import { ObjectId } from "mongodb";
export default class AllocationEngine {
    static async process(consumed) {
        if (!consumed.length)
            return;
        const db = getDb();
        const ordersCollection = db.collection("orders");
        // Group by orderId
        const grouped = {};
        for (const entry of consumed) {
            if (!grouped[entry.orderId])
                grouped[entry.orderId] = [];
            grouped[entry.orderId].push(entry);
        }
        const orderIds = Object.keys(grouped);
        const orders = await ordersCollection.find({
            _id: { $in: orderIds.map(id => new ObjectId(id)) }
        }).toArray();
        for (const order of orders) {
            const entries = grouped[order._id.toString()];
            for (const entry of entries) {
                const item = order.items.find((i) => i.prodId === entry.itemId);
                if (!item)
                    continue;
                item.fulfilledQty = Math.min(item.quantity, (item.fulfilledQty || 0) + entry.qty);
            }
            const allComplete = order.items.every((i) => (i.fulfilledQty || 0) >= i.quantity);
            if (allComplete && order.status === 2) {
                await ordersCollection.updateOne({ _id: order._id }, { $set: { status: 3, updatedAt: Date.now() } });
            }
            else {
                await ordersCollection.updateOne({ _id: order._id }, { $set: { items: order.items, updatedAt: Date.now() } });
            }
        }
    }
}
