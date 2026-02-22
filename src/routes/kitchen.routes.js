import express from "express";
import KitchenService from "../../dist/services/KitchenService.js";
import MongoDatasource from "../services/datasource/MongoDatasource.js";
import { emitKitchenUpdate } from "../../dist/socket/SocketGateway.js";

const router = express.Router();
const ds = new MongoDatasource();

router.get("/snapshot", async (req, res) => {
  try {
    const data = await KitchenService.getSnapshot();
    res.json(data);
  } catch (error) {
    console.error("Kitchen snapshot error:", error);
    res.status(500).json({ error: "Failed to fetch snapshot" });
  }
});

// 🔥 Decrement endpoint
router.post("/decrement", async (req, res) => {
  try {
    const { itemId, quantity } = req.body;

    if (!itemId || !quantity) {
      return res.status(400).json({ error: "Missing itemId or quantity" });
    }

    await KitchenService.decrementItem(itemId, quantity);

    // Broadcast updated snapshot
    const snapshot = await KitchenService.getSnapshot();
    emitKitchenUpdate(snapshot);

    res.json({ success: true });
  } catch (error) {
    console.error("Kitchen decrement error:", error);
    res.status(500).json({ error: "Failed to decrement item" });
  }
});

// 🔥 Clear item endpoint
router.post("/clear", async (req, res) => {
  try {
    const { itemId } = req.body;

    const orderIds = await KitchenService.clearItem(itemId);

    // cancel those orders
    for (const id of orderIds) {
      await ds.updateOrderStatus(id, { status: 5 });
    }

    const snapshot = await KitchenService.getSnapshot();
    emitKitchenUpdate(snapshot);

    res.json({ success: true });
  } catch (error) {
    console.error("Kitchen clear error:", error);
    res.status(500).json({ error: "Failed to clear item" });
  }
});

export default router;
