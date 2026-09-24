import mongoose, { Schema } from "mongoose";

const otpSchema = new Schema(
  {
    email: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    code: {
      type: String,
      required: true,
    },
    type: {
      type: String,
      enum: ["email_verification", "password_reset"],
      required: true,
    },
    expiresAt: {
      type: Date,
      required: true,
      expires: 0,
    },
    consumed: {
      type: Boolean,
      default: false,
    },
    attempts: {
      type: Number,
      default: 0,
    },
    maxAttempts: {
      type: Number,
      default: 5,
    },
  },
  {
    timestamps: true,
  }
);

export const Otp = mongoose.model("Otp", otpSchema);
export default Otp;
