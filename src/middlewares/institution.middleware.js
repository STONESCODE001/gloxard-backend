import { Institution } from "../models/Institution.model.js";

/**
 * Tenant isolation middleware (institutionContext):
 * Extracts req.user.institutionId, validates tenant existence & active status,
 * and binds req.institutionId and req.institution.
 */
export const institutionContext = async (req, res, next) => {
  try {
    if (!req.user) {
      return res.status(401).json({
        error: "Authentication token missing or malformed",
      });
    }

    const institutionId = req.user.institutionId;
    if (!institutionId) {
      return res.status(403).json({
        error: "No institution workspace associated with this user account",
      });
    }

    const institution = await Institution.findById(institutionId);
    if (!institution) {
      return res.status(404).json({
        error: "Institution workspace not found",
      });
    }

    if (institution.status === "suspended") {
      return res.status(403).json({
        error: "Institution workspace has been suspended. Please contact platform support.",
      });
    }

    req.institutionId = institution._id;
    req.institution = institution;
    next();
  } catch (error) {
    next(error);
  }
};

export default institutionContext;
