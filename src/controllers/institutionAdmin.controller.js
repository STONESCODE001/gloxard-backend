import { Institution } from "../models/Institution.model.js";

const HEX_COLOR_REGEX = /^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6})$/;

/**
 * GET /api/institutions/me
 * Resumes onboarding wizard state: returns institution data, onboarding steps, plan, and branding.
 */
export const getInstitutionMe = async (req, res, next) => {
  try {
    const institution = await Institution.findById(req.institutionId)
      .populate("adminUserId", "firstName lastName email role avatarUrl")
      .populate("applicationId", "institutionName type website address representative");

    if (!institution) {
      return res.status(404).json({
        error: "Institution workspace not found",
        code: "INSTITUTION_NOT_FOUND",
      });
    }

    return res.status(200).json({
      institution,
      onboarding: institution.onboarding || { currentStep: 1, completedSteps: [] },
      plan: institution.plan,
      billing: institution.billing,
      branding: institution.branding,
      seatLimit: institution.seatLimit,
      status: institution.status,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/institutions/me/branding
 * Step 1 & 6: Updates displayName, color (#hex), tagline, and logoUrl (must be verified S3 logos/ key).
 * Advances onboarding step.
 */
export const updateBranding = async (req, res, next) => {
  try {
    const { displayName, color, tagline, logoUrl } = req.body || {};

    const institution = await Institution.findById(req.institutionId);
    if (!institution) {
      return res.status(404).json({
        error: "Institution workspace not found",
        code: "INSTITUTION_NOT_FOUND",
      });
    }

    // Validate color if provided
    if (color && !HEX_COLOR_REGEX.test(color.trim())) {
      return res.status(400).json({
        error: "Invalid branding color format. Must be a valid hex color code (e.g. #4F46E5)",
        code: "VALIDATION_ERROR",
      });
    }

    // Validate logoUrl: must reference verified S3 logos/ path if provided
    if (logoUrl !== undefined && logoUrl !== null && String(logoUrl).trim() !== "") {
      const trimmedLogo = String(logoUrl).trim();
      if (!trimmedLogo.includes("logos/") && !trimmedLogo.startsWith("logos/")) {
        return res.status(400).json({
          error: "Logo URL must reference a valid S3 logos/ key or path",
          code: "INVALID_LOGO_KEY",
        });
      }
      institution.logoUrl = trimmedLogo;
    }

    if (!institution.branding) {
      institution.branding = {};
    }

    if (displayName !== undefined) {
      institution.branding.displayName = String(displayName).trim();
    }
    if (color !== undefined) {
      institution.branding.color = String(color).trim();
    }
    if (tagline !== undefined) {
      institution.branding.tagline = String(tagline).trim();
    }

    // Update onboarding progression (Step 1 completed, advance to step 2 if on step 1)
    if (!institution.onboarding) {
      institution.onboarding = { currentStep: 2, completedSteps: [1] };
    } else {
      if (!institution.onboarding.completedSteps.includes(1)) {
        institution.onboarding.completedSteps.push(1);
      }
      if (institution.onboarding.currentStep === 1) {
        institution.onboarding.currentStep = 2;
      }
    }

    await institution.save();

    return res.status(200).json({
      message: "Branding updated successfully",
      institution,
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getInstitutionMe,
  updateBranding,
};
