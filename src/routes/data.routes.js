import express from "express";
import {
  query,
  queryPaginated,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
} from "../controllers/data.controller.js";

const router = express.Router();

router.post("/query", query);
router.post("/query/paginated", queryPaginated);

router.get("/doc/:collection/:docId", getDoc);
router.put("/doc/:collection/:docId", setDoc);
router.patch("/doc/:collection/:docId", updateDoc);
router.delete("/doc/:collection/:docId", deleteDoc);

export default router;
