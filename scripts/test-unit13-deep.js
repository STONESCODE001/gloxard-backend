import dotenv from "dotenv";
dotenv.config();

import http from "http";
import mongoose from "mongoose";
import { io as ClientIO } from "socket.io-client";
import { app } from "../src/app.js";
import { initSocket, emitNotification, broadcastNotification } from "../src/socket/socket.handler.js";
import connectDB from "../src/config/db.js";
import { User } from "../src/models/User.model.js";
import { Conversation } from "../src/models/Conversation.model.js";
import { Message } from "../src/models/Message.model.js";
import { Notification } from "../src/models/Notification.model.js";
import { signToken } from "../src/utils/jwt.js";

const TEST_PORT = 3098;
const BASE_URL = `http://localhost:${TEST_PORT}`;

let server;
let userA, userB, userC;
let tokenA, tokenB, tokenC;
let conversationId;

const runDeepTests = async () => {
  console.log("\n🔬 Starting Deep End-to-End Bug & Edge Case Sweep for Unit 13...\n");

  try {
    await connectDB();

    server = http.createServer(app);
    initSocket(server);

    await new Promise((resolve) => {
      server.listen(TEST_PORT, () => {
        console.log(`⚙️ Deep test server running on port ${TEST_PORT}`);
        resolve();
      });
    });

    // Clean old test data
    await User.deleteMany({ username: { $in: ["u13_deep_a", "u13_deep_b", "u13_deep_c"] } });
    await Conversation.deleteMany({});
    await Message.deleteMany({});
    await Notification.deleteMany({});

    // Create 3 Test Users
    userA = await User.create({
      firstName: "Alice",
      lastName: "Smith",
      username: "u13_deep_a",
      email: "u13_deep_a@test.com",
      password: "Password123!",
      role: "student",
      isVerified: true
    });

    userB = await User.create({
      firstName: "Bob",
      lastName: "Instructor",
      username: "u13_deep_b",
      email: "u13_deep_b@test.com",
      password: "Password123!",
      role: "instructor",
      isVerified: true
    });

    userC = await User.create({
      firstName: "Charlie",
      lastName: "Outsider",
      username: "u13_deep_c",
      email: "u13_deep_c@test.com",
      password: "Password123!",
      role: "student",
      isVerified: true
    });

    tokenA = signToken({ sub: userA._id.toString(), role: userA.role });
    tokenB = signToken({ sub: userB._id.toString(), role: userB.role });
    tokenC = signToken({ sub: userC._id.toString(), role: userC.role });

    console.log("👥 Test Users Initialized:");
    console.log(`   Alice (Student): ${userA._id}`);
    console.log(`   Bob (Instructor): ${userB._id}`);
    console.log(`   Charlie (Outsider): ${userC._id}\n`);

    // ==========================================
    // SECTION 1: SOCKET HANDSHAKE & AUTH ERRORS
    // ==========================================
    console.log("--- 1. Socket.io Handshake Authentication Edge Cases ---");
    
    // 1.1 No Token Handshake
    const failSocket1 = ClientIO(BASE_URL, { autoConnect: false });
    await new Promise((resolve) => {
      failSocket1.on("connect_error", (err) => {
        console.log("  ✓ Socket connection without token rejected correctly:", err.message);
        resolve();
      });
      failSocket1.connect();
    });

    // 1.2 Invalid Token Handshake
    const failSocket2 = ClientIO(BASE_URL, { auth: { token: "invalid.jwt.token" }, autoConnect: false });
    await new Promise((resolve) => {
      failSocket2.on("connect_error", (err) => {
        console.log("  ✓ Socket connection with invalid token rejected correctly:", err.message);
        resolve();
      });
      failSocket2.connect();
    });

    // 1.3 Valid Socket Connections for Alice and Bob
    const socketA = ClientIO(BASE_URL, { auth: { token: tokenA } });
    const socketB = ClientIO(BASE_URL, { auth: { token: tokenB } });

    await new Promise((resolve, reject) => {
      let count = 0;
      socketA.on("connect", () => { if (++count === 2) resolve(); });
      socketB.on("connect", () => { if (++count === 2) resolve(); });
      socketA.on("connect_error", reject);
      socketB.on("connect_error", reject);
    });
    console.log("  ✓ Valid JWT Socket connections authenticated for Alice & Bob.");


    // ==========================================
    // SECTION 2: CONVERSATION ENDPOINTS & VALIDATIONS
    // ==========================================
    console.log("\n--- 2. Conversation Endpoints Validation Sweep ---");

    // 2.1 Missing recipientId
    const res2_1 = await fetch(`${BASE_URL}/api/messages/conversations/new`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({})
    });
    console.log("  ✓ Missing recipientId status:", res2_1.status, "(expected 400)");
    if (res2_1.status !== 400) throw new Error("Expected 400 for missing recipientId");

    // 2.2 Self Conversation
    const res2_2 = await fetch(`${BASE_URL}/api/messages/conversations/new`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ recipientId: userA._id.toString() })
    });
    console.log("  ✓ Self conversation status:", res2_2.status, "(expected 400)");
    if (res2_2.status !== 400) throw new Error("Expected 400 for self conversation");

    // 2.3 Non-existent Recipient
    const nonExistentId = new mongoose.Types.ObjectId().toString();
    const res2_3 = await fetch(`${BASE_URL}/api/messages/conversations/new`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ recipientId: nonExistentId })
    });
    console.log("  ✓ Non-existent recipient status:", res2_3.status, "(expected 404)");
    if (res2_3.status !== 404) throw new Error("Expected 404 for non-existent recipient");

    // 2.4 Valid Conversation Creation (Alice -> Bob)
    const res2_4 = await fetch(`${BASE_URL}/api/messages/conversations/new`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ recipientId: userB._id.toString() })
    });
    const data2_4 = await res2_4.json();
    console.log("  ✓ Create conversation status:", res2_4.status, "(expected 201)");
    if (res2_4.status !== 201 && res2_4.status !== 200) throw new Error("Failed creating conversation");
    conversationId = data2_4.conversation._id;
    console.log(`    Created Conversation ID: ${conversationId}`);


    // ==========================================
    // SECTION 3: SOCKET TYPING & ROOM INDICATORS
    // ==========================================
    console.log("\n--- 3. Socket Room Join & Typing Indicator Events ---");

    socketB.emit("join_conversation", { conversationId });
    await new Promise((r) => setTimeout(r, 500));

    // Listen for typing event on Bob's socket
    let typingReceived = null;
    let stopTypingReceived = null;

    socketB.on("typing", (data) => {
      console.log("  📡 Bob received socket event `typing`:", data);
      typingReceived = data;
    });

    socketB.on("stop_typing", (data) => {
      console.log("  📡 Bob received socket event `stop_typing`:", data);
      stopTypingReceived = data;
    });

    // Alice emits typing and stop_typing
    socketA.emit("typing", { conversationId });
    await new Promise((r) => setTimeout(r, 200));

    socketA.emit("stop_typing", { conversationId });
    await new Promise((r) => setTimeout(r, 200));

    if (!typingReceived || typingReceived.conversationId !== conversationId) {
      throw new Error("Typing socket event failed");
    }
    if (!stopTypingReceived || stopTypingReceived.conversationId !== conversationId) {
      throw new Error("Stop typing socket event failed");
    }
    console.log("  ✓ Socket typing indicators verified successfully!");


    // ==========================================
    // SECTION 4: MESSAGING REST API VALIDATIONS & BROADCAST
    // ==========================================
    console.log("\n--- 4. Messaging REST API Validation Sweep ---");

    // 4.1 Post Empty Text
    const res4_1 = await fetch(`${BASE_URL}/api/messages/${conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ text: "   " })
    });
    console.log("  ✓ Post empty message status:", res4_1.status, "(expected 400)");
    if (res4_1.status !== 400) throw new Error("Expected 400 for empty text");

    // 4.2 Post Message to Invalid Conversation ID
    const res4_2 = await fetch(`${BASE_URL}/api/messages/${nonExistentId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ text: "Hello?" })
    });
    console.log("  ✓ Post to non-existent conversation status:", res4_2.status, "(expected 404)");
    if (res4_2.status !== 404) throw new Error("Expected 404 for invalid conversation ID");

    // 4.3 Post Message by Non-Participant (Charlie)
    const res4_3 = await fetch(`${BASE_URL}/api/messages/${conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenC}` },
      body: JSON.stringify({ text: "I am intruding!" })
    });
    console.log("  ✓ Post message by non-participant status:", res4_3.status, "(expected 403)");
    if (res4_3.status !== 403) throw new Error("Expected 403 for non-participant message post");

    // 4.4 Valid Message Post (Alice -> Bob)
    let socketMessageReceived = null;
    socketB.on("new_message", (data) => {
      console.log("  📡 Bob received socket event `new_message`:", data.text);
      socketMessageReceived = data;
    });

    const res4_4 = await fetch(`${BASE_URL}/api/messages/${conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ text: "Hi Bob, welcome to the course!" })
    });
    const data4_4 = await res4_4.json();
    console.log("  ✓ Valid message post status:", res4_4.status, "(expected 201)");
    if (res4_4.status !== 201) throw new Error("Failed posting valid message");

    await new Promise((r) => setTimeout(r, 200));
    if (!socketMessageReceived || socketMessageReceived.text !== "Hi Bob, welcome to the course!") {
      throw new Error("Socket new_message event missing or payload corrupted");
    }

    // 4.5 Reply Message (Bob -> Alice)
    const res4_5 = await fetch(`${BASE_URL}/api/messages/${conversationId}`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenB}` },
      body: JSON.stringify({ text: "Thanks Alice! Glad to be here." })
    });
    console.log("  ✓ Reply message post status:", res4_5.status, "(expected 201)");
    if (res4_5.status !== 201) throw new Error("Failed posting reply message");


    // ==========================================
    // SECTION 5: CONVERSATIONS LIST & UNREAD COUNT
    // ==========================================
    console.log("\n--- 5. Conversations Directory & Unread Count Calculation ---");

    // Bob has 1 unread message from Alice? Wait, Bob sent the last message!
    // Let's check Alice's conversations. Alice has 1 unread message from Bob!
    const res5_1 = await fetch(`${BASE_URL}/api/messages/conversations`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const data5_1 = await res5_1.json();
    console.log("  ✓ Alice GET /api/messages/conversations status:", res5_1.status);
    console.log("    Conversations count:", data5_1.conversations.length);
    console.log("    Alice's Unread Count:", data5_1.conversations[0].unreadCount);
    console.log("    Last Message Snippet:", data5_1.conversations[0].lastMessage.text);

    if (data5_1.conversations[0].unreadCount !== 1) {
      throw new Error(`Expected unreadCount = 1 for Alice, got ${data5_1.conversations[0].unreadCount}`);
    }


    // ==========================================
    // SECTION 6: MESSAGE HISTORY & AUTO-READ MARKING
    // ==========================================
    console.log("\n--- 6. Message History & Auto-Read Transition ---");

    // Alice fetches message history -> should auto-mark unread messages as read
    const res6_1 = await fetch(`${BASE_URL}/api/messages/${conversationId}?page=1&limit=10`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const data6_1 = await res6_1.json();
    console.log("  ✓ Alice GET /api/messages/:conversationId status:", res6_1.status);
    console.log("    Total messages in thread:", data6_1.pagination.totalMessages);
    console.log("    Messages returned:", data6_1.messages.length);

    if (data6_1.messages.length !== 2) throw new Error("Expected 2 messages in thread");

    // Re-check Alice's unread count on conversation directory -> should now be 0!
    const res6_2 = await fetch(`${BASE_URL}/api/messages/conversations`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const data6_2 = await res6_2.json();
    console.log("  ✓ Alice GET /api/messages/conversations post-read unreadCount:", data6_2.conversations[0].unreadCount, "(expected 0)");
    if (data6_2.conversations[0].unreadCount !== 0) {
      throw new Error("Auto-read transition failed; unreadCount is not 0");
    }


    // ==========================================
    // SECTION 7: NOTIFICATIONS & MARK READ SWEEP
    // ==========================================
    console.log("\n--- 7. In-App Notifications & Mark Read Sweep ---");

    // Create 3 notifications for Alice (2 unread, 1 read)
    const n1 = await Notification.create({
      recipient: userA._id,
      title: "New Quiz Available",
      message: "Module 1 quiz is now open",
      type: "quiz_published",
      read: false
    });
    const n2 = await Notification.create({
      recipient: userA._id,
      title: "Grade Released",
      message: "You scored 95% on Quiz 1",
      type: "quiz_graded",
      read: false
    });
    const n3 = await Notification.create({
      recipient: userA._id,
      title: "Welcome Bonus",
      message: "Welcome to Gloxad Academy",
      type: "system_broadcast",
      read: true
    });

    // 7.1 Fetch all notifications
    const res7_1 = await fetch(`${BASE_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const data7_1 = await res7_1.json();
    console.log("  ✓ Alice GET /api/notifications count:", data7_1.notifications.length, "(expected 3)");
    console.log("    Unread Count:", data7_1.unreadCount, "(expected 2)");
    if (data7_1.notifications.length !== 3 || data7_1.unreadCount !== 2) {
      throw new Error("Notification fetch or unreadCount mismatch");
    }

    // 7.2 Fetch unreadOnly notifications
    const res7_2 = await fetch(`${BASE_URL}/api/notifications?unreadOnly=true`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const data7_2 = await res7_2.json();
    console.log("  ✓ Alice GET /api/notifications?unreadOnly=true count:", data7_2.notifications.length, "(expected 2)");
    if (data7_2.notifications.length !== 2) {
      throw new Error("unreadOnly filter failed");
    }

    // 7.3 Mark specific notification read (n1)
    const res7_3 = await fetch(`${BASE_URL}/api/notifications/mark-read`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ notificationIds: [n1._id.toString()] })
    });
    const data7_3 = await res7_3.json();
    console.log("  ✓ Mark specific read updatedCount:", data7_3.updatedCount, "(expected 1)");
    if (data7_3.updatedCount !== 1) throw new Error("Failed marking single notification as read");

    // 7.4 Mark all notifications read (markAll: true)
    const res7_4 = await fetch(`${BASE_URL}/api/notifications/mark-read`, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${tokenA}` },
      body: JSON.stringify({ markAll: true })
    });
    const data7_4 = await res7_4.json();
    console.log("  ✓ Mark all read updatedCount:", data7_4.updatedCount, "(expected 1)");
    if (data7_4.updatedCount !== 1) throw new Error("Failed marking all notifications as read");

    // Verify unread count is now 0
    const res7_5 = await fetch(`${BASE_URL}/api/notifications`, {
      headers: { Authorization: `Bearer ${tokenA}` }
    });
    const data7_5 = await res7_5.json();
    console.log("  ✓ Final unreadCount post markAll:", data7_5.unreadCount, "(expected 0)");
    if (data7_5.unreadCount !== 0) throw new Error("markAll failed to clear unreadCount");

    // Disconnect socket clients
    socketA.disconnect();
    socketB.disconnect();

    console.log("\n==================================================");
    console.log("🏆 ALL DEEP EDGE CASE & BUG SWEEP TESTS PASSED! 🏆");
    console.log("==================================================\n");

  } catch (err) {
    console.error("\n❌ DEEP TEST SWEEP ERROR:", err);
    process.exitCode = 1;
  } finally {
    if (userA) {
      await User.deleteMany({ username: { $in: ["u13_deep_a", "u13_deep_b", "u13_deep_c"] } });
      await Conversation.deleteMany({});
      await Message.deleteMany({});
      await Notification.deleteMany({});
    }
    if (server) server.close();
    await mongoose.connection.close();
  }
};

runDeepTests();
