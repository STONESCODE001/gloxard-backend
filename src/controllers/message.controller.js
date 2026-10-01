import mongoose from "mongoose";
import { Conversation } from "../models/Conversation.model.js";
import { Message } from "../models/Message.model.js";
import { User } from "../models/User.model.js";
import { emitNewMessage } from "../socket/socket.handler.js";

const formatUser = (userDoc) => {
  if (!userDoc) return null;
  const obj = userDoc.toObject ? userDoc.toObject() : { ...userDoc };
  return {
    _id: obj._id ? obj._id.toString() : String(userDoc),
    firstName: obj.firstName || "",
    lastName: obj.lastName || "",
    avatar: obj.avatarUrl || obj.avatar || "",
    avatarUrl: obj.avatarUrl || obj.avatar || "",
    role: obj.role || "student"
  };
};

/**
 * 1. GET /api/messages/conversations
 * Fetch active conversations for authenticated user
 */
export const getConversationsController = async (req, res, next) => {
  try {
    const userId = req.user._id;

    const rawConversations = await Conversation.find({ participants: userId })
      .populate("participants", "firstName lastName avatarUrl avatar role")
      .populate({
        path: "lastMessage",
        populate: { path: "sender", select: "firstName lastName avatarUrl avatar role" }
      })
      .sort({ updatedAt: -1 });

    const conversations = await Promise.all(
      rawConversations.map(async (conv) => {
        const convObj = conv.toObject();
        
        // Count unread messages for this user in this conversation
        const unreadCount = await Message.countDocuments({
          conversationId: conv._id,
          sender: { $ne: userId },
          readBy: { $ne: userId }
        });

        // Format participants
        const participants = (conv.participants || []).map((p) => formatUser(p));

        // Format lastMessage if present
        let lastMessage = null;
        if (conv.lastMessage) {
          const lmObj = conv.lastMessage.toObject ? conv.lastMessage.toObject() : conv.lastMessage;
          lastMessage = {
            _id: lmObj._id.toString(),
            sender: lmObj.sender?._id ? lmObj.sender._id.toString() : lmObj.sender.toString(),
            text: lmObj.text || "",
            createdAt: lmObj.createdAt
          };
        }

        return {
          _id: convObj._id.toString(),
          participants,
          courseId: convObj.courseId ? convObj.courseId.toString() : null,
          lastMessage,
          unreadCount,
          updatedAt: convObj.updatedAt
        };
      })
    );

    return res.status(200).json({ conversations });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. POST /api/messages/conversations/new
 * Create or get existing 1:1 conversation
 */
export const createOrGetConversationController = async (req, res, next) => {
  try {
    const { recipientId, courseId } = req.body;
    const currentUserId = req.user._id;

    if (!recipientId || recipientId.toString() === currentUserId.toString()) {
      return res.status(400).json({
        error: "Recipient ID is required and cannot be yourself"
      });
    }

    if (!mongoose.Types.ObjectId.isValid(recipientId)) {
      return res.status(400).json({ error: "Invalid recipient ID" });
    }

    const recipientUser = await User.findById(recipientId);
    if (!recipientUser) {
      return res.status(404).json({ error: "Recipient user not found" });
    }

    // Check for existing 1:1 conversation between these users
    let existingConv = await Conversation.findOne({
      isGroup: false,
      participants: { $all: [currentUserId, recipientId], $size: 2 }
    }).populate("participants", "firstName lastName avatarUrl avatar role");

    if (existingConv) {
      // If courseId supplied and conversation doesn't have courseId, update it
      if (courseId && !existingConv.courseId && mongoose.Types.ObjectId.isValid(courseId)) {
        existingConv.courseId = courseId;
        await existingConv.save();
      }

      const convObj = existingConv.toObject();
      return res.status(200).json({
        message: "Conversation initialized",
        conversation: {
          _id: convObj._id.toString(),
          participants: convObj.participants.map((p) => p._id.toString()),
          courseId: convObj.courseId ? convObj.courseId.toString() : null,
          lastMessage: convObj.lastMessage ? convObj.lastMessage.toString() : null,
          updatedAt: convObj.updatedAt
        }
      });
    }

    // Create new conversation
    const newConv = await Conversation.create({
      participants: [currentUserId, recipientId],
      courseId: courseId && mongoose.Types.ObjectId.isValid(courseId) ? courseId : null,
      isGroup: false
    });

    const populatedConv = await Conversation.findById(newConv._id).populate(
      "participants",
      "firstName lastName avatarUrl avatar role"
    );
    const convObj = populatedConv.toObject();

    return res.status(201).json({
      message: "Conversation initialized",
      conversation: {
        _id: convObj._id.toString(),
        participants: convObj.participants.map((p) => p._id.toString()),
        courseId: convObj.courseId ? convObj.courseId.toString() : null,
        lastMessage: null,
        updatedAt: convObj.updatedAt
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. GET /api/messages/:conversationId
 * Fetch paginated message history for a conversation
 */
export const getMessagesController = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const userIdStr = req.user._id.toString();
    const isParticipant = conversation.participants.some(
      (p) => p.toString() === userIdStr
    );
    if (!isParticipant) {
      return res.status(403).json({
        error: "Access denied. You are not a participant in this conversation"
      });
    }

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 50;
    const skip = (pageNum - 1) * limitNum;

    // Mark unread messages in this conversation as read by the caller FIRST
    await Message.updateMany(
      {
        conversationId,
        readBy: { $ne: req.user._id }
      },
      {
        $addToSet: { readBy: req.user._id }
      }
    );

    const totalMessages = await Message.countDocuments({ conversationId });

    const rawMessages = await Message.find({ conversationId })
      .sort({ createdAt: 1 })
      .skip(skip)
      .limit(limitNum)
      .populate("sender", "firstName lastName avatarUrl avatar role");

    const messages = rawMessages.map((msg) => {
      const msgObj = msg.toObject();
      return {
        _id: msgObj._id.toString(),
        conversationId: msgObj.conversationId.toString(),
        sender: formatUser(msg.sender),
        text: msgObj.text,
        readBy: (msgObj.readBy || []).map((id) => id.toString()),
        createdAt: msgObj.createdAt
      };
    });

    return res.status(200).json({
      messages,
      pagination: {
        page: pageNum,
        limit: limitNum,
        totalMessages
      }
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. POST /api/messages/:conversationId
 * Send a message in a conversation
 */
export const sendMessageController = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { text } = req.body;

    if (!text || !text.trim()) {
      return res.status(400).json({ error: "Message text is required" });
    }

    if (!mongoose.Types.ObjectId.isValid(conversationId)) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) {
      return res.status(404).json({ error: "Conversation not found" });
    }

    const userIdStr = req.user._id.toString();
    const isParticipant = conversation.participants.some(
      (p) => p.toString() === userIdStr
    );
    if (!isParticipant) {
      return res.status(403).json({
        error: "Access denied. You are not a participant in this conversation"
      });
    }

    const newMessage = await Message.create({
      conversationId,
      sender: req.user._id,
      text: text.trim(),
      readBy: [req.user._id]
    });

    // Update conversation's lastMessage & updatedAt
    conversation.lastMessage = newMessage._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    const populatedMsg = await Message.findById(newMessage._id).populate(
      "sender",
      "firstName lastName avatarUrl avatar role"
    );

    const messageData = {
      _id: populatedMsg._id.toString(),
      conversationId: populatedMsg.conversationId.toString(),
      sender: formatUser(populatedMsg.sender),
      text: populatedMsg.text,
      readBy: (populatedMsg.readBy || []).map((id) => id.toString()),
      createdAt: populatedMsg.createdAt
    };

    // Emit Socket.io real-time message event
    emitNewMessage(conversationId.toString(), messageData);

    return res.status(201).json({
      message: "Message sent successfully",
      data: messageData
    });
  } catch (error) {
    next(error);
  }
};
