import { getDb } from "../config/mongodb.js";
import AllocationEngine from "./AllocationEngine.js";
export default class KitchenService {
    static collection() {
        return getDb().collection("kitchen_items");
    }
    static async addOrderItems(order) {
        for (const item of order.items) {
            await this.collection().updateOne({ itemId: item.prodId }, {
                $inc: { totalQuantity: item.quantity },
                $push: {
                    allocations: {
                        orderId: order._id.toString(),
                        qty: item.quantity
                    }
                },
                $set: {
                    itemName: item.name,
                    lastUpdatedAt: Date.now()
                }
            }, { upsert: true });
        }
    }
    static async decrementItem(itemId, quantity) {
        const doc = await this.collection().findOne({ itemId });
        if (!doc)
            return;
        let remaining = quantity;
        const consumed = [];
        const updatedAllocations = [];
        for (const entry of doc.allocations) {
            if (remaining <= 0) {
                updatedAllocations.push(entry);
                continue;
            }
            if (entry.qty <= remaining) {
                consumed.push({
                    orderId: entry.orderId,
                    itemId,
                    qty: entry.qty
                });
                remaining -= entry.qty;
            }
            else {
                consumed.push({
                    orderId: entry.orderId,
                    itemId,
                    qty: remaining
                });
                updatedAllocations.push({
                    orderId: entry.orderId,
                    qty: entry.qty - remaining
                });
                remaining = 0;
            }
        }
        const newTotal = Math.max(doc.totalQuantity - quantity, 0);
        await this.collection().updateOne({ itemId }, {
            $set: {
                allocations: updatedAllocations,
                totalQuantity: newTotal,
                lastUpdatedAt: Date.now()
            }
        });
        // 🔥 CALL ALLOCATION ENGINE
        await AllocationEngine.process(consumed);
    }
    static async getSnapshot() {
        return this.collection()
            .find({ totalQuantity: { $gt: 0 } })
            .toArray();
    }
    static async clearItem(itemId) {
        await this.collection().deleteOne({ itemId });
    }
}
