import { getDb } from "../config/mongodb.js";
export default class KitchenService {
    static collection() {
        return getDb().collection("kitchen_items");
    }
    static async addOrderItems(order) {
        for (const item of order.items) {
            await this.collection().updateOne({ itemId: item.prodId }, {
                $inc: { totalQuantity: item.quantity },
                $set: {
                    itemName: item.name,
                    lastUpdatedAt: Date.now()
                }
            }, { upsert: true });
        }
    }
    static async decrementItem(itemId, quantity) {
        await this.collection().updateOne({ itemId }, {
            $inc: { totalQuantity: -quantity },
            $set: { lastUpdatedAt: Date.now() }
        });
        await this.collection().deleteMany({
            itemId,
            totalQuantity: { $lte: 0 }
        });
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
