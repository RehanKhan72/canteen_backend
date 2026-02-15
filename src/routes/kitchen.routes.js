import express from "express";
import KitchenService from "../../dist/services/KitchenService.js";

const router = express.Router();

router.get("/snapshot", async (req, res) => {
  try {
    const data = await KitchenService.getSnapshot();
    res.json(data);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch snapshot" });
  }
});

export default router;
