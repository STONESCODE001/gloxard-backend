import dotenv from "dotenv";
dotenv.config();

import { sendEmailVerificationOtp } from "../src/utils/email.js";

const testRecipient = "gloxad07@gmail.com";
const testOtp = "8492";

console.log(`📨 Triggering live verification email to: ${testRecipient}...`);

sendEmailVerificationOtp(testRecipient, testOtp)
  .then((result) => {
    console.log("✅ Email Dispatch Result:", result);
    process.exit(0);
  })
  .catch((err) => {
    console.error("❌ Email Dispatch Error:", err);
    process.exit(1);
  });
