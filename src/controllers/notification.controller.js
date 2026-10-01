import mongoose from "mongoose";
import { Notification } from "../models/Notification.model.js";

/**
 * 1. GET /api/notifications
 * Fetch notifications for authenticated user
 */
export const getNotificationsController = async (req, res, next) => {
  try {
    const { unreadOnly = "false", page = 1, limit = 20 } = req.query;

    const pageNum = parseInt(page, 10) || 1;
    const limitNum = parseInt(limit, 10) || 20;
    const skip = (pageNum - 1) * limitNum;

    const baseFilter = {
      $or: [
        { recipient: req.user._id },
        { targetRole: req.user.role },
        { targetRole: "all" }
      ]
    };

    const isUnreadOnly = unreadOnly === "true" || unreadOnly === true;
    const filter = isUnreadOnly ? { ...baseFilter, read: false } : baseFilter;

    const unreadCount = await Notification.countDocuments({
      ...baseFilter,
      read: false
    });

    const rawNotifications = await Notification.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limitNum);

    const notifications = rawNotifications.map((notif) => {
      const obj = notif.toObject ? notif.toObject() : notif;
      return {
        _id: obj._id.toString(),
        recipient: obj.recipient ? obj.recipient.toString() : null,
        targetRole: obj.targetRole || null,
        title: obj.title,
        message: obj.message,
        type: obj.type || "system_broadcast",
        read: obj.read,
        link: obj.link || null,
        createdAt: obj.createdAt
      };
    });

    return res.status(200).json({
      notifications,
      unreadCount
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. POST /api/notifications/mark-read
 * Mark specified or all notifications as read
 */
export const markNotificationsReadController = async (req, res, next) => {
  try {
    const { notificationIds, markAll } = req.body;

    const baseFilter = {
      $or: [
        { recipient: req.user._id },
        { targetRole: req.user.role },
        { targetRole: "all" }
      ]
    };

    let updatedCount = 0;

    if (markAll === true) {
      const result = await Notification.updateMany(
        { ...baseFilter, read: false },
        { $set: { read: true } }
      );
      updatedCount = result.modifiedCount !== undefined ? result.modifiedCount : result.nModified || 0;
    } else if (Array.isArray(notificationIds) && notificationIds.length > 0) {
      const validIds = notificationIds.filter((id) => mongoose.Types.ObjectId.isValid(id));
      if (validIds.length > 0) {
        const result = await Notification.updateMany(
          { _id: { $in: validIds }, ...baseFilter },
          { $set: { read: true } }
        );
        updatedCount = result.modifiedCount !== undefined ? result.modifiedCount : result.nModified || 0;
      }
    }

    return res.status(200).json({
      message: "Notifications marked as read",
      updatedCount
    });
  } catch (error) {
    next(error);
  }
};
