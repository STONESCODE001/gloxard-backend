import rateLimit from "express-rate-limit";

const createLimiter = (maxRequests, windowMinutes = 15) => {
  return rateLimit({
    windowMs: windowMinutes * 60 * 1000,
    max: maxRequests,
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
  authLimiter,
  otpLimiter,
};
