import { Router } from "express";
import { deleteAccountController } from "../controller/account.controller.js";
const router = Router();
router.delete("/account/delete", deleteAccountController);
export default router;
