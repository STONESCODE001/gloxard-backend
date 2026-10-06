import dotenv from "dotenv";
dotenv.config();

import { generatePresignedPutUrl } from "../src/utils/s3.js";
import { sendPasswordResetOtp } from "../src/utils/email.js";
import { S3Client, PutObjectCommand, GetObjectCommand } from "@aws-sdk/client-s3";

async function testS3Upload() {
  console.log("--- TESTING ISSUE 1: IMAGE UPLOAD ---");
  try {
    const presigned = await generatePresignedPutUrl({
      filename: "test-avatar.png",
      fileType: "image/png",
      folder: "avatars",
    });
    console.log("Generated presigned data:", presigned);

    console.log("Testing direct HTTP PUT to presigned uploadUrl...");
    const uploadRes = await fetch(presigned.uploadUrl, {
      method: "PUT",
      headers: {
        "Content-Type": "image/png",
      },
      body: Buffer.from("fake image data"),
    });

    console.log("Upload HTTP status:", uploadRes.status, uploadRes.statusText);
    const uploadResponseBody = await uploadRes.text();
    console.log("Upload response body:", uploadResponseBody);

    console.log("Testing public GET access to fileUrl:", presigned.fileUrl);
    const getRes = await fetch(presigned.fileUrl);
    console.log("GET file status:", getRes.status, getRes.statusText);
    if (!getRes.ok) {
      console.log("GET error body:", await getRes.text());
    }
  } catch (err) {
    console.error("S3 Test Error:", err);
  }
}

async function testPasswordResetOtp() {
  console.log("\n--- TESTING ISSUE 2: PASSWORD RESET OTP ---");
  try {
    const testEmail = "gloxad07@gmail.com";
    const testOtp = "54321";
    console.log(`Sending password reset OTP to ${testEmail}...`);
    const result = await sendPasswordResetOtp(testEmail, testOtp);
    console.log("Password Reset Email Result:", result);
  } catch (err) {
    console.error("Password Reset OTP Error:", err);
  }
}

async function run() {
  await testS3Upload();
  await testPasswordResetOtp();
  process.exit(0);
}

run();
