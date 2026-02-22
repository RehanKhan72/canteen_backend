import { Collection } from "mongodb";
import { getDb } from "../config/mongodb.js";
import AllocationEngine from "./AllocationEngine.js";

interface AllocationEntry {
  orderId: string;
  qty: number;
}

interface KitchenDocument {
  itemId: string;
  itemName: string;
  totalQuantity: number;
  allocations: AllocationEntry[];
  lastUpdatedAt: number;
}

export default class KitchenService {

  private static collection(): Collection<KitchenDocument> {
    return getDb().collection("kitchen_items");
  }

  static async addOrderItems(order: any): Promise<void> {

    for (const item of order.items) {

      await this.collection().updateOne(
        { itemId: item.prodId },
        {
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
        },
        { upsert: true }
      );
    }
  }

  static async decrementItem(itemId: string, quantity: number) {

    const doc = await this.collection().findOne({ itemId });
    if (!doc) return;

    let remaining = quantity;
    const consumed: any[] = [];
    const updatedAllocations: AllocationEntry[] = [];

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
      } else {
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

    await this.collection().updateOne(
      { itemId },
      {
        $set: {
          allocations: updatedAllocations,
          totalQuantity: newTotal,
          lastUpdatedAt: Date.now()
        }
      }
    );

    // 🔥 CALL ALLOCATION ENGINE
    await AllocationEngine.process(consumed);
  }

  static async getSnapshot() {
    return this.collection()
      .find({ totalQuantity: { $gt: 0 } })
      .toArray();
  }

  static async clearItem(itemId: string) {
    await this.collection().deleteOne({ itemId });
  }
}
