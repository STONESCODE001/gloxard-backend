import express from "express";
import { authGuard } from "../middlewares/auth.middleware.js";
import {
  getConversationsController,
  createOrGetConversationController,
  getMessagesController,
  sendMessageController,
} from "../controllers/message.controller.js";

const router = express.Router();

router.get("/conversations", authGuard, getConversationsController);
router.post("/conversations/new", authGuard, createOrGetConversationController);
router.get("/:conversationId", authGuard, getMessagesController);
router.post("/:conversationId", authGuard, sendMessageController);

export default router;
