import rateLimit from "express-rate-limit";

const createLimiter = (maxRequests, windowMinutes = 15) => {
  const isDevOrTest = process.env.NODE_ENV !== "production";
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: isDevOrTest ? Math.max(maxRequests, 100) : maxRequests,
    standardHeaders: true, // Draft-6 RateLimit headers and Retry-After
    legacyHeaders: false,
    handler: (req, res) => {
      res.status(429).json({
        error: "Too many attempts, please try again later",
      });
    },
  });
};

export const signupLimiter = createLimiter(10);
export const signinLimiter = createLimiter(10);
export const resendVerificationLimiter = createLimiter(5);
export const verifyEmailLimiter = createLimiter(10);
export const forgotPasswordLimiter = createLimiter(5);
export const verifyOtpLimiter = createLimiter(10);
export const resetPasswordLimiter = createLimiter(5);
export const updatePasswordLimiter = createLimiter(10);
export const updateProfileLimiter = createLimiter(30);
export const partnerApplicationLimiter = createLimiter(20);
export const memberInviteLimiter = createLimiter(5);

// Backward compatibility exports
export const authLimiter = signinLimiter;
export const otpLimiter = verifyEmailLimiter;

export default {
  signupLimiter,
  signinLimiter,
  resendVerificationLimiter,
  verifyEmailLimiter,
  forgotPasswordLimiter,
  verifyOtpLimiter,
  resetPasswordLimiter,
  updatePasswordLimiter,
  updateProfileLimiter,
  partnerApplicationLimiter,
  memberInviteLimiter,
  authLimiter,
  otpLimiter,
};
