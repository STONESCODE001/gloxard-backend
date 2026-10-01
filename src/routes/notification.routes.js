import express from "express";
import { authGuard } from "../middlewares/auth.middleware.js";
import {
  getNotificationsController,
  markNotificationsReadController,
} from "../controllers/notification.controller.js";

const router = express.Router();

router.get("/", authGuard, getNotificationsController);
router.post("/mark-read", authGuard, markNotificationsReadController);

export default router;
