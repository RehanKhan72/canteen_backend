import express from "express";
import KitchenService from "../../dist/services/KitchenService.js";
import { emitKitchenUpdate } from "../../dist/socket/SocketGateway.js";

const router = express.Router();

router.get("/snapshot", async (req, res) => {
  try {
    const data = await KitchenService.getSnapshot();
    res.json(data);
  } catch (error) {
    console.error("Kitchen snapshot error:", error);
    res.status(500).json({ error: "Failed to fetch snapshot" });
  }
});

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

router.post("/clear", async (req, res) => {
  try {
    const { itemId } = req.body;

    if (!itemId) {
      return res.status(400).json({ error: "Missing itemId" });
    }

    await KitchenService.clearItem(itemId);

    // Broadcast updated snapshot
    const snapshot = await KitchenService.getSnapshot();
    emitKitchenUpdate(snapshot);

    res.json({ success: true });
  } catch (error) {
    console.error("Kitchen clear error:", error);
    res.status(500).json({ error: "Failed to clear item" });
  }
});

export default router;
