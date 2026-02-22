// src/services/AllocationEngine.ts
import MongoDatasource from "../../src/services/datasource/MongoDatasource.js";
import FCMService from "../../src/services/fcm.service.js";
import { getDb } from "../config/mongodb.js";

interface ConsumedEntry {
    orderId: string;
    itemId: string;
    qty: number;
}

interface OrderDoc {
    _id: string;
    status: number;
    items: {
        prodId: string;
        quantity: number;
        fulfilledQty?: number;
    }[];
}

const ORDER_STATUS_MAP: Record<number, string> = {
    [-1]: "Not paid",
    0: "Paid not accepted",
    1: "Accepted",
    2: "In making",
    3: "Ready to pick",
    4: "Picked up",
    5: "Cancelled",
    6: "Payment failed",
};

export default class AllocationEngine {

    static async process(consumed: ConsumedEntry[]) {
        console.log("AllocationEngine called with:", consumed);
        if (!consumed.length) return;

        const db = getDb();
        const ordersCollection = db.collection<OrderDoc>("OrderHistory");
        const ds = new MongoDatasource();

        const grouped: Record<string, ConsumedEntry[]> = {};
        for (const entry of consumed) {
            if (!grouped[entry.orderId]) grouped[entry.orderId] = [];
            grouped[entry.orderId].push(entry);
        }
        
        const orderIds = Object.keys(grouped);
        
        const orders = await ordersCollection.find({
            _id: { $in: orderIds }
        }).toArray();
        
        console.log("Orders found:", orders.length);

        for (const order of orders) {

            const entries = grouped[order._id.toString()];
            if (!entries) continue;

            for (const entry of entries) {

                const item = order.items.find(
                    i => i.prodId === entry.itemId
                );

                if (!item) continue;

                item.fulfilledQty = Math.min(
                    item.quantity,
                    (item.fulfilledQty || 0) + entry.qty
                );
            }

            const allComplete = order.items.every(
                i => (i.fulfilledQty || 0) >= i.quantity
            );

            const wasStatus2 = order.status === 2;
            const newStatus = allComplete && wasStatus2 ? 3 : order.status;

            await ordersCollection.updateOne(
                { _id: order._id },
                {
                    $set: {
                        items: order.items,
                        status: newStatus,
                        updatedAt: Date.now()
                    }
                }
            );

            // 🔥 Trigger notification ONLY when status changes to 3
            if (wasStatus2 && newStatus === 3) {

                try {
                    const token = await ds.getCustomerToken(order._id);

                    if (token) {
                        await FCMService.sendNotificationToTokens(
                            [token],
                            "Order Update",
                            "Your order is now Ready to pick",
                            {
                                orderId: order._id,
                                status: 3,
                                readableStatus: ORDER_STATUS_MAP[3]
                            }
                        );
                    }
                } catch (err) {
                    console.error("Ready notification failed:", err);
                }
            }
        }
    }
}