import { Router } from "express";
import {
  requestPasswordReset,
  serveResetPage,
  resetPassword,
} from "../controller/password.controller.js";

const router = Router();

router.post("/auth/request-reset", requestPasswordReset);
router.get("/reset-password", serveResetPage);
router.post("/reset-password", resetPassword);

export default router;