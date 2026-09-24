import { Router } from "express";
import {
  signup,
  signin,
  getMe,
  signout,
  verifyEmail,
  forgotPassword,
  verifyOtp,
  resetPassword,
  updatePassword,
} from "../controllers/auth.controller.js";
import { authGuard } from "../middlewares/auth.middleware.js";
import { authLimiter, otpLimiter } from "../middlewares/rateLimiter.middleware.js";

const router = Router();

router.post("/signup", authLimiter, signup);
router.post("/signin", authLimiter, signin);
router.get("/me", authGuard, getMe);
router.post("/signout", signout);
router.post("/verify-email", otpLimiter, verifyEmail);
router.post("/forget-passwd", otpLimiter, forgotPassword);
router.post("/verify-otp", otpLimiter, verifyOtp);
router.post("/reset-passwd", otpLimiter, resetPassword);
router.post("/update-password", authGuard, updatePassword);

export default router;
