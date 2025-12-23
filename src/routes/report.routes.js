import express from "express";
import { generateReport } from "../controllers/report.controller.js";

const router = express.Router();

router.post("/generate", generateReport);

export default router;
