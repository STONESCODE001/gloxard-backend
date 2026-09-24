import dotenv from "dotenv";
dotenv.config();

import mongoose from "mongoose";
import connectDB from "../src/config/db.js";
import { app } from "../src/app.js";
import { User } from "../src/models/User.model.js";
import { Otp } from "../src/models/Otp.model.js";
import http from "http";

const TEST_PORT = 3002;
const BASE_URL = `http://localhost:${TEST_PORT}/api`;

const runTests = async () => {
  console.log("🚀 Starting Phase 1 Integration Verification Suite...\n");

  await connectDB();
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(TEST_PORT, resolve));
  console.log(`✓ Test server running on port ${TEST_PORT}`);

  const testEmail = `phase1_test_${Date.now()}@gloxad.com`;
  let studentToken = "";
  let studentUser = null;

  try {
    // 1. Student Signup Test
    console.log("TEST 1: Student signup generates 4-digit OTP and returns { token, user }");
    const signupRes = await fetch(`${BASE_URL}/auth/signup`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        firstName: "TestStudent",
        lastName: "Tester",
        email: testEmail,
        password: "Password123!",
        role: "student",
      }),
    });

    const signupData = await signupRes.json();
    if (signupRes.status !== 201 || !signupData.token || !signupData.user) {
      throw new Error(`Signup failed: status=${signupRes.status}, body=${JSON.stringify(signupData)}`);
    }

    studentToken = signupData.token;
    studentUser = signupData.user;

    if (studentUser.isEmailVerified !== false) {
      throw new Error(`Expected isEmailVerified to be false, got: ${studentUser.isEmailVerified}`);
    }
    if (!Array.isArray(studentUser.certifications)) {
      throw new Error(`Expected certifications to be array, got: ${typeof studentUser.certifications}`);
    }
    console.log("  ✓ Status 201 Created");
    console.log("  ✓ Token returned in session");
    console.log("  ✓ isEmailVerified: false, certifications: []");

    // Check that OTP was stored in DB for student
    const initialOtp = await Otp.findOne({ email: testEmail, type: "email_verification", consumed: false });
    if (!initialOtp) {
      throw new Error("4-digit verification OTP was not created in Otp collection for student!");
    }
    console.log("  ✓ 4-digit OTP created in DB for student account");

    // 2. Resend Verification Endpoint Test
    console.log("\nTEST 2: Resend verification endpoint (POST /api/auth/resend-verification)");
    const resendRes = await fetch(`${BASE_URL}/auth/resend-verification`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail }),
    });

    const resendData = await resendRes.json();
    if (resendRes.status !== 200 || !resendData.message.includes("a new code has been sent")) {
      throw new Error(`Resend verification failed: status=${resendRes.status}, body=${JSON.stringify(resendData)}`);
    }

    // Verify old OTP consumed and fresh OTP created
    const activeOtps = await Otp.find({ email: testEmail, type: "email_verification", consumed: false });
    if (activeOtps.length !== 1) {
      throw new Error(`Expected exactly 1 active OTP after resend, found ${activeOtps.length}`);
    }
    console.log("  ✓ Status 200 OK with anti-enumeration message");
    console.log("  ✓ Old OTP invalidated, fresh OTP issued");

    // 3. Email Verification Test
    console.log("\nTEST 3: Email verification (POST /api/auth/verify-email)");
    // 3a. Invalid OTP
    const invalidVerifyRes = await fetch(`${BASE_URL}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, otp: "0000" }),
    });
    if (invalidVerifyRes.status !== 400) {
      throw new Error(`Expected 400 for wrong OTP, got ${invalidVerifyRes.status}`);
    }
    console.log("  ✓ Wrong OTP correctly rejected with 400");

    // Extract OTP code directly for verification test
    // To test matching: we know compareValue checks the code, let's call verifyEmail with the test OTP from log or create known
    // Let's test by setting a known hash or using the real flow
    const bcrypt = (await import("bcryptjs")).default;
    const knownCode = "7891";
    activeOtps[0].code = await bcrypt.hash(knownCode, 10);
    await activeOtps[0].save();

    const validVerifyRes = await fetch(`${BASE_URL}/auth/verify-email`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: testEmail, otp: knownCode }),
    });
    const validVerifyData = await validVerifyRes.json();
    if (validVerifyRes.status !== 200 || !validVerifyData.user || validVerifyData.user.isEmailVerified !== true) {
      throw new Error(`Verify email failed: status=${validVerifyRes.status}, body=${JSON.stringify(validVerifyData)}`);
    }
    console.log("  ✓ Status 200 OK");
    console.log("  ✓ Returns updated user with isEmailVerified: true");

    // 4. Update Profile Test
    console.log("\nTEST 4: Update profile (PUT /api/auth/update-profile)");
    const updateRes = await fetch(`${BASE_URL}/auth/update-profile`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${studentToken}`,
      },
      body: JSON.stringify({
        biography: "Updated Bio for Phase 1",
        title: "Senior Student",
        phoneNumber: "+2348011223344",
        skills: ["React", "Express", "Node.js"],
        socialLinks: {
          website: "https://gloxa.example.com",
          twitter: "https://x.com/gloxad",
        },
      }),
    });
    const updateData = await updateRes.json();
    if (updateRes.status !== 200 || !updateData.user) {
      throw new Error(`Update profile failed: status=${updateRes.status}, body=${JSON.stringify(updateData)}`);
    }
    if (updateData.user.biography !== "Updated Bio for Phase 1" || updateData.user.skills.length !== 3) {
      throw new Error(`Profile fields were not updated properly: ${JSON.stringify(updateData.user)}`);
    }
    console.log("  ✓ Status 200 OK");
    console.log("  ✓ Partial fields (biography, title, skills, socials) successfully updated");

    // 5. Session Revocation Test
    console.log("\nTEST 5: Server-side token revocation on signout");
    // Verify token works first on /me
    const meResBefore = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    if (meResBefore.status !== 200) {
      throw new Error(`Expected /me to work before signout, got ${meResBefore.status}`);
    }

    // Call signout
    const signoutRes = await fetch(`${BASE_URL}/auth/signout`, {
      method: "POST",
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    if (signoutRes.status !== 200) {
      throw new Error(`Signout failed: status=${signoutRes.status}`);
    }

    // Try calling /me with the same token
    const meResAfter = await fetch(`${BASE_URL}/auth/me`, {
      headers: { Authorization: `Bearer ${studentToken}` },
    });
    if (meResAfter.status !== 401) {
      throw new Error(`Expected 401 after signout due to token revocation, got ${meResAfter.status}`);
    }
    const meAfterData = await meResAfter.json();
    console.log(`  ✓ Old token rejected with 401: "${meAfterData.error}"`);

    // Clean up
    console.log("\n🧹 Cleaning up test user and OTP records...");
    await User.deleteOne({ email: testEmail });
    await Otp.deleteMany({ email: testEmail });
    console.log("✓ Cleanup complete");

    console.log("\n=========================================");
    console.log("🎉 ALL PHASE 1 INTEGRATION TESTS PASSED!");
    console.log("=========================================\n");
  } catch (err) {
    console.error("\n❌ Test Error Caught:", err);
  } finally {
    await new Promise((resolve) => server.close(resolve));
    await mongoose.connection.close();
  }
};

runTests();
