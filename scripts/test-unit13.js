import dotenv from "dotenv";
dotenv.config();

import http from "http";
import mongoose from "mongoose";
import { io as ClientIO } from "socket.io-client";
import { app } from "../src/app.js";
import { initSocket, emitNotification } from "../src/socket/socket.handler.js";
import connectDB from "../src/config/db.js";
import { User } from "../src/models/User.model.js";
import { Conversation } from "../src/models/Conversation.model.js";
import { Message } from "../src/models/Message.model.js";
import { Notification } from "../src/models/Notification.model.js";
import { signToken } from "../src/utils/jwt.js";

const TEST_PORT = 3099;
const BASE_URL = `http://localhost:${TEST_PORT}`;

let server;
let user1, user2, user3;
let token1, token2, token3;
let conversationId;

const runTests = async () => {
  console.log("\n🧪 Starting Unit 13 — Real-Time Messaging & Notifications Integration Tests...\n");

  try {
    await connectDB();

    server = http.createServer(app);
    initSocket(server);

    await new Promise((resolve) => {
      server.listen(TEST_PORT, () => {
        console.log(`✅ Test server running on port ${TEST_PORT}`);
        resolve();
      });
    });

    // Cleanup old test data
    await User.deleteMany({ email: { $in: ["u13_student1@test.com", "u13_student2@test.com", "u13_outsider@test.com"] } });
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    await Notification.deleteMany({});

    // Create test users
    user1 = await User.create({
      firstName: "Unit13",
      lastName: "User1",
      username: "u13_student1",
      email: "u13_student1@test.com",
      password: "Password123!",
      role: "student",
      isVerified: true
    });

    user2 = await User.create({
      firstName: "Unit13",
      lastName: "User2",
      username: "u13_student2",
      email: "u13_student2@test.com",
      password: "Password123!",
      role: "instructor",
      isVerified: true
    });

    user3 = await User.create({
      firstName: "Unit13",
      lastName: "Outsider",
      username: "u13_outsider",
      email: "u13_outsider@test.com",
      password: "Password123!",
      role: "student",
      isVerified: true
    });

    token1 = signToken({ sub: user1._id.toString(), role: user1.role });
    token2 = signToken({ sub: user2._id.toString(), role: user2.role });
    token3 = signToken({ sub: user3._id.toString(), role: user3.role });

    console.log("👤 Test Users Created:");
    console.log(`   User 1 ID: ${user1._id}`);
    console.log(`   User 2 ID: ${user2._id}`);
    console.log(`   User 3 ID: ${user3._id}`);

    // --- TEST 1: Initialize 1:1 Conversation ---
    console.log("\n--- Test 1: POST /api/messages/conversations/new ---");
    const convRes = await fetch(`${BASE_URL}/api/messages/conversations/new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token1}`
      },
      body: JSON.stringify({ recipientId: user2._id.toString() })
    });
    const convData = await convRes.json();
    console.log("Status:", convRes.status);
    console.log("Response:", JSON.stringify(convData, null, 2));

    if (convRes.status !== 201 && convRes.status !== 200) {
      throw new Error("Failed to initialize conversation");
    }
    conversationId = convData.conversation._id;

    // Verify idempotency: posting again returns existing conversation
    const convResDuplicate = await fetch(`${BASE_URL}/api/messages/conversations/new`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token1}`
      },
      body: JSON.stringify({ recipientId: user2._id.toString() })
    });
    const convDataDuplicate = await convResDuplicate.json();
    console.log("Idempotent Call Status:", convResDuplicate.status);
    if (convDataDuplicate.conversation._id !== conversationId) {
      throw new Error("Idempotency check failed: Returned different conversation ID");
    }
    console.log("✅ Conversation initialization & idempotency passed!");

    // --- TEST 2: GET /api/messages/conversations ---
    console.log("\n--- Test 2: GET /api/messages/conversations ---");
    const getConvsRes = await fetch(`${BASE_URL}/api/messages/conversations`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const getConvsData = await getConvsRes.json();
    console.log("Status:", getConvsRes.status);
    console.log("Conversations Count:", getConvsData.conversations.length);
    if (getConvsRes.status !== 200 || getConvsData.conversations.length === 0) {
      throw new Error("Failed to fetch conversations");
    }
    console.log("✅ Fetch conversations passed!");

    // --- TEST 3: Socket.io Handshake & Real-Time Messaging Broadcast ---
    console.log("\n--- Test 3: Socket.io Handshake & Real-Time Message Event ---");
    const clientSocket1 = ClientIO(BASE_URL, {
      auth: { token: token1 }
    });
    const clientSocket2 = ClientIO(BASE_URL, {
      auth: { token: token2 }
    });

    await new Promise((resolve, reject) => {
      let connectedCount = 0;
      clientSocket1.on("connect", () => {
        connectedCount++;
        if (connectedCount === 2) resolve();
      });
      clientSocket2.on("connect", () => {
        connectedCount++;
        if (connectedCount === 2) resolve();
      });
      clientSocket1.on("connect_error", (err) => reject(err));
      clientSocket2.on("connect_error", (err) => reject(err));
    });
    console.log("✅ Both Socket.io clients authenticated and connected successfully!");

    // Client 2 joins conversation room
    clientSocket2.emit("join_conversation", { conversationId });

    // Listen for real-time new_message event on Client 2
    let messageReceivedOnSocket = null;
    const messagePromise = new Promise((resolve) => {
      clientSocket2.on("new_message", (data) => {
        console.log("📡 Client 2 received real-time Socket event `new_message`:", data);
        messageReceivedOnSocket = data;
        resolve();
      });
    });

    // Client 1 posts message via REST API
    console.log("\n--- Test 4: POST /api/messages/:conversationId ---");
    const sendMsgRes = await fetch(`${BASE_URL}/api/messages/${conversationId}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token1}`
      },
      body: JSON.stringify({ text: "Hello User 2! This is a real-time message test." })
    });
    const sendMsgData = await sendMsgRes.json();
    console.log("Status:", sendMsgRes.status);
    console.log("Response:", JSON.stringify(sendMsgData, null, 2));

    if (sendMsgRes.status !== 201) {
      throw new Error("Failed to post chat message");
    }

    // Wait for Socket event delivery
    await messagePromise;
    if (!messageReceivedOnSocket || messageReceivedOnSocket.text !== "Hello User 2! This is a real-time message test.") {
      throw new Error("Socket.io real-time message delivery failed");
    }
    console.log("✅ REST message post & Socket.io real-time broadcast passed!");

    // --- TEST 5: GET /api/messages/:conversationId (History & Auto-Read) ---
    console.log("\n--- Test 5: GET /api/messages/:conversationId ---");
    const msgHistRes = await fetch(`${BASE_URL}/api/messages/${conversationId}`, {
      headers: { Authorization: `Bearer ${token2}` }
    });
    const msgHistData = await msgHistRes.json();
    console.log("Status:", msgHistRes.status);
    console.log("Messages History Count:", msgHistData.messages.length);
    console.log("ReadBy Array for User 2:", msgHistData.messages[0].readBy);

    if (msgHistRes.status !== 200 || msgHistData.messages.length === 0) {
      throw new Error("Failed to fetch message history");
    }
    if (!msgHistData.messages[0].readBy.includes(user2._id.toString())) {
      throw new Error("Auto-read verification failed");
    }
    console.log("✅ Message history & auto-read passed!");

    // --- TEST 6: Participant Guard (Forbidden for Outsider User 3) ---
    console.log("\n--- Test 6: Participant Security Guard (User 3 403 Test) ---");
    const forbiddenRes = await fetch(`${BASE_URL}/api/messages/${conversationId}`, {
      headers: { Authorization: `Bearer ${token3}` }
    });
    const forbiddenData = await forbiddenRes.json();
    console.log("Status:", forbiddenRes.status);
    console.log("Response:", forbiddenData);
    if (forbiddenRes.status !== 403) {
      throw new Error("Participant security guard failed (expected 403)");
    }
    console.log("✅ Participant security guard passed (403 Forbidden verified)!");

    // --- TEST 7: In-App Notifications API & Real-Time Push ---
    console.log("\n--- Test 7: Notifications & Real-Time Socket Push ---");

    // Create a notification for User 1
    const notificationObj = await Notification.create({
      recipient: user1._id,
      title: "Enrollment Confirmed",
      message: "You are enrolled in Python 101",
      type: "enrollment_success",
      read: false
    });

    // Listen for new_notification event on Client 1
    const notificationPromise = new Promise((resolve) => {
      clientSocket1.on("new_notification", (data) => {
        console.log("📡 Client 1 received real-time Socket event `new_notification`:", data);
        resolve(data);
      });
    });

    // Emit real-time notification
    emitNotification(user1._id.toString(), notificationObj);
    await notificationPromise;

    // Fetch Notifications via REST
    const notifRes = await fetch(`${BASE_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${token1}` }
    });
    const notifData = await notifRes.json();
    console.log("GET /api/notifications Status:", notifRes.status);
    console.log("Unread Count:", notifData.unreadCount);
    console.log("Notifications Count:", notifData.notifications.length);

    if (notifRes.status !== 200 || notifData.unreadCount !== 1) {
      throw new Error("Failed to fetch notifications");
    }

    // Mark Notification Read via REST
    const markReadRes = await fetch(`${BASE_URL}/api/notifications/mark-read`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token1}`
      },
      body: JSON.stringify({ notificationIds: [notificationObj._id.toString()] })
    });
    const markReadData = await markReadRes.json();
    console.log("POST /api/notifications/mark-read Status:", markReadRes.status);
    console.log("Updated Count:", markReadData.updatedCount);

    if (markReadRes.status !== 200 || markReadData.updatedCount !== 1) {
      throw new Error("Failed to mark notification as read");
    }
    console.log("✅ In-App Notifications REST API & Socket push passed!");

    // Clean up connections
    clientSocket1.disconnect();
    clientSocket2.disconnect();

    console.log("\n🎉 ALL UNIT 13 INTEGRATION TESTS PASSED SUCCESSFULLY! 🚀\n");
  } catch (error) {
    console.error("\n❌ TEST FAILURE:", error);
    process.exitCode = 1;
  } finally {
    // Cleanup test data
    if (user1) {
      await User.deleteMany({ email: { $in: ["u13_student1@test.com", "u13_student2@test.com", "u13_outsider@test.com"] } });
      await Conversation.deleteMany({});
      await Message.deleteMany({});
      await Notification.deleteMany({});
    }
    if (server) {
      server.close();
    }
    await mongoose.connection.close();
  }
};

runTests();
