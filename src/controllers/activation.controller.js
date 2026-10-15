import crypto from "crypto";
import { Institution } from "../models/Institution.model.js";
import { User } from "../models/User.model.js";
import { generateToken } from "../utils/jwt.js";

/**
 * POST /api/institutions/activate
 * Public activation endpoint: Validates 7-day token & min 12-char password.
 * Creates or activates admin User, marks activationUsed, transitions status to "onboarding",
 * and returns { token, user, institution }.
 */
export const activateInstitution = async (req, res, next) => {
  try {
    const { token, password, firstName, lastName, name } = req.body || {};

    if (!token || typeof token !== "string" || !token.trim()) {
      return res.status(400).json({
        error: "Activation token is required",
        code: "VALIDATION_ERROR",
      });
    }

    if (!password || typeof password !== "string" || password.length < 12) {
      return res.status(400).json({
        error: "Password must be at least 12 characters long",
        code: "WEAK_PASSWORD",
      });
    }

    // SHA-256 hash of the incoming raw token
    const rawToken = token.trim();
    const hashedToken = crypto.createHash("sha256").update(rawToken).digest("hex");

    // Look for matching institution
    const institution = await Institution.findOne({
      $or: [{ activationToken: hashedToken }, { activationToken: rawToken }],
    }).populate("applicationId");

    if (!institution) {
      return res.status(410).json({
        error: "Activation token is invalid or does not exist",
        code: "TOKEN_EXPIRED",
      });
    }

    if (institution.activationUsed) {
      return res.status(410).json({
        error: "Activation token has already been used",
        code: "TOKEN_EXPIRED",
      });
    }

    if (institution.activationExpiresAt && new Date(institution.activationExpiresAt) < new Date()) {
      return res.status(410).json({
        error: "Activation token has expired",
        code: "TOKEN_EXPIRED",
      });
    }

    const email = institution.representativeEmail.toLowerCase().trim();
    let user = await User.findOne({ email });

    // Derive names if new user or empty
    let derivedFirstName = firstName?.trim() || "";
    let derivedLastName = lastName?.trim() || "";

    if (!derivedFirstName && name && typeof name === "string") {
      const parts = name.trim().split(" ");
      derivedFirstName = parts[0] || "Admin";
      derivedLastName = parts.slice(1).join(" ") || "";
    }

    if (!derivedFirstName && institution.applicationId?.representative?.name) {
      const parts = institution.applicationId.representative.name.trim().split(" ");
      derivedFirstName = parts[0] || "Admin";
      derivedLastName = parts.slice(1).join(" ") || "";
    }

    if (!derivedFirstName) {
      derivedFirstName = "Institution";
      derivedLastName = "Admin";
    }

    if (user) {
      user.role = "institution_admin";
      user.institutionId = institution._id;
      user.isVerified = true;
      user.approvalStatus = "approved";
      user.password = password; // Trigger pre-save hash
      if (derivedFirstName && (!user.firstName || user.firstName === "User")) {
        user.firstName = derivedFirstName;
      }
      if (derivedLastName && !user.lastName) {
        user.lastName = derivedLastName;
      }
      await user.save();
    } else {
      user = await User.create({
        firstName: derivedFirstName,
        lastName: derivedLastName,
        email,
        password,
        role: "institution_admin",
        institutionId: institution._id,
        isVerified: true,
        approvalStatus: "approved",
      });
    }

    // Update institution lifecycle
    institution.adminUserId = user._id;
    institution.activationUsed = true;
    institution.status = "onboarding";
    if (!institution.onboarding) {
      institution.onboarding = { currentStep: 1, completedSteps: [] };
    }
    await institution.save();

    // Issue 7-day JWT token
    const jwtToken = generateToken(user);

    return res.status(200).json({
      message: "Institution workspace activated successfully",
      token: jwtToken,
      user,
      institution,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  activateInstitution,
};
