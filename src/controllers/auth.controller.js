import { User } from "../models/User.model.js";
import { Otp } from "../models/Otp.model.js";
import { hashValue, compareValue } from "../utils/hash.js";
import { signToken } from "../utils/jwt.js";
import { sendEmailVerificationOtp, sendPasswordResetOtp } from "../utils/email.js";

/**
 * 1. signup (POST /api/auth/signup)
 * Register student or instructor
 */
export const signup = async (req, res, next) => {
  try {
    const { email, password, firstName, lastName, role } = req.body;

    if (!firstName || !email || !password) {
      return res.status(400).json({
        error: "First name, email, and password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const assignedRole = role === "instructor" ? "instructor" : "student";

    const existingUser = await User.findOne({ email: normalizedEmail });
    if (existingUser) {
      return res.status(409).json({
        error: "User with this email or username already exists",
      });
    }

    // Generate unique username if not provided
    const baseUsername = normalizedEmail.split("@")[0].replace(/[^a-zA-Z0-9]/g, "");
    let username = baseUsername;
    let counter = 1;
    while (await User.findOne({ username })) {
      username = `${baseUsername}${counter++}`;
    }

    const user = new User({
      email: normalizedEmail,
      password,
      firstName: firstName.trim(),
      lastName: lastName ? lastName.trim() : "",
      username,
      role: assignedRole,
      approvalStatus: assignedRole === "instructor" ? "pending" : "approved",
      isVerified: false,
    });

    await user.save();

    // If instructor, generate 4-digit OTP and send email verification
    if (assignedRole === "instructor") {
      const otpCode = Math.floor(1000 + Math.random() * 9000).toString();
      const hashedOtp = await hashValue(otpCode, 10);

      await Otp.create({
        email: normalizedEmail,
        code: hashedOtp,
        type: "email_verification",
        expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
        consumed: false,
      });

      await sendEmailVerificationOtp(normalizedEmail, otpCode);
    }

    return res.status(201).json({
      message: "User registered successfully",
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        isVerified: user.isVerified,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 2. signin (POST /api/auth/signin)
 * Authenticate user & issue JWT
 */
export const signin = async (req, res, next) => {
  try {
    const { email, username, password } = req.body;
    const identifier = email || username;

    if (!identifier || !password) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const normalizedIdentifier = identifier.trim().toLowerCase();
    const user = await User.findOne({
      $or: [{ email: normalizedIdentifier }, { username: normalizedIdentifier }],
    });

    if (!user) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({
        error: "Invalid email or password",
      });
    }

    user.lastLoginAt = new Date();
    await user.save({ validateBeforeSave: false });

    const token = signToken({
      sub: user._id,
      role: user.role,
    });

    return res.status(200).json({
      token,
      user: {
        _id: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
        approvalStatus: user.approvalStatus,
        isVerified: user.isVerified,
        avatarUrl: user.avatarUrl,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 3. getMe (GET /api/auth/me)
 * Return authenticated caller's profile
 */
export const getMe = async (req, res, next) => {
  try {
    return res.status(200).json({
      user: req.user,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 4. signout (POST /api/auth/signout)
 * Client-side session acknowledgment
 */
export const signout = async (req, res, next) => {
  try {
    return res.status(200).json({
      message: "Successfully signed out",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 5. verifyEmail (POST /api/auth/verify-email)
 * 4-digit OTP email verification
 */
export const verifyEmail = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        error: "Email and OTP code are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();

    const otpRecord = await Otp.findOne({
      email: normalizedEmail,
      type: "email_verification",
      consumed: false,
    }).sort({ createdAt: -1 });

    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      return res.status(400).json({
        error: "Invalid or expired OTP code",
      });
    }

    const isMatch = await compareValue(otp, otpRecord.code);
    if (!isMatch) {
      return res.status(400).json({
        error: "Invalid or expired OTP code",
      });
    }

    otpRecord.consumed = true;
    await otpRecord.save();

    await User.findOneAndUpdate(
      { email: normalizedEmail },
      { isVerified: true }
    );

    return res.status(200).json({
      message: "Email verified successfully",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 6. forgotPassword (POST /api/auth/forget-passwd)
 * Request 5-digit password recovery OTP
 */
export const forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({
        error: "Email is required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const user = await User.findOne({ email: normalizedEmail });

    // Anti-enumeration protection
    if (!user) {
      return res.status(200).json({
        message: "If the account exists, an OTP has been sent",
      });
    }

    const otpCode = Math.floor(10000 + Math.random() * 90000).toString();
    const hashedOtp = await hashValue(otpCode, 10);

    await Otp.create({
      email: normalizedEmail,
      code: hashedOtp,
      type: "password_reset",
      expiresAt: new Date(Date.now() + 15 * 60 * 1000), // 15 mins
      consumed: false,
    });

    await sendPasswordResetOtp(normalizedEmail, otpCode);

    return res.status(200).json({
      message: "Password reset OTP dispatched to email",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 7. verifyOtp (POST /api/auth/verify-otp)
 * Validate 5-digit OTP without consuming it
 */
export const verifyOtp = async (req, res, next) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({
        error: "Email and OTP code are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const otpRecord = await Otp.findOne({
      email: normalizedEmail,
      type: "password_reset",
      consumed: false,
    }).sort({ createdAt: -1 });

    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      return res.status(400).json({
        error: "Invalid or expired OTP code",
      });
    }

    const isMatch = await compareValue(otp, otpRecord.code);
    if (!isMatch) {
      return res.status(400).json({
        error: "Invalid or expired OTP code",
      });
    }

    return res.status(200).json({
      valid: true,
      message: "OTP is valid",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 8. resetPassword (POST /api/auth/reset-passwd)
 * Consume 5-digit OTP and reset password
 */
export const resetPassword = async (req, res, next) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({
        error: "Email, OTP, and new password are required",
      });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const otpRecord = await Otp.findOne({
      email: normalizedEmail,
      type: "password_reset",
      consumed: false,
    }).sort({ createdAt: -1 });

    if (!otpRecord || otpRecord.expiresAt < new Date()) {
      return res.status(400).json({
        error: "Invalid or expired OTP code",
      });
    }

    const isMatch = await compareValue(otp, otpRecord.code);
    if (!isMatch) {
      return res.status(400).json({
        error: "Invalid or expired OTP code",
      });
    }

    const user = await User.findOne({ email: normalizedEmail });
    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    otpRecord.consumed = true;
    await otpRecord.save();

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      message: "Password reset successfully. You can now sign in with your new password.",
    });
  } catch (error) {
    next(error);
  }
};

/**
 * 9. updatePassword (POST /api/auth/update-password)
 * Authenticated password update
 */
export const updatePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({
        error: "Current password and new password are required",
      });
    }

    const user = await User.findById(req.user._id);
    if (!user) {
      return res.status(404).json({
        error: "User not found",
      });
    }

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(400).json({
        error: "Current password does not match",
      });
    }

    user.password = newPassword;
    await user.save();

    return res.status(200).json({
      message: "Password updated successfully",
    });
  } catch (error) {
    next(error);
  }
};

export default {
  signup,
  signin,
  getMe,
  signout,
  verifyEmail,
  forgotPassword,
  verifyOtp,
  resetPassword,
  updatePassword,
};
