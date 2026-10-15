import { Cohort } from "../models/Cohort.model.js";
import { LmsQuizAttempt } from "../models/LmsQuizAttempt.model.js";
import { LmsSubmission } from "../models/LmsSubmission.model.js";
import { LmsLessonComment } from "../models/LmsLessonComment.model.js";

/**
 * Cohort Resolution & Gating Guard
 * Enforces strict cohort isolation, auto-resolves active cohort when omitted,
 * and verifies enrollment membership before allowing access to /api/lms/* routes.
 */
export const cohortGuard = async (req, res, next) => {
  try {
    let cohortId = req.query.cohortId || req.params.cohortId || req.body?.cohortId;

    // Attempt to infer cohortId from entity route parameters if omitted
    if (!cohortId && req.params.attemptId) {
      const attempt = await LmsQuizAttempt.findById(req.params.attemptId);
      if (attempt) cohortId = attempt.cohortId;
    }
    if (!cohortId && req.params.submissionId) {
      const sub = await LmsSubmission.findById(req.params.submissionId);
      if (sub) cohortId = sub.cohortId;
    }
    if (!cohortId && req.params.id) {
      // Check if it's a submission or comment
      const [sub, comment] = await Promise.all([
        LmsSubmission.findById(req.params.id),
        LmsLessonComment.findById(req.params.id)
      ]);
      if (sub) cohortId = sub.cohortId;
      else if (comment) cohortId = comment.cohortId;
    }

    let cohort = null;

    if (cohortId) {
      cohort = await Cohort.findById(cohortId)
        .populate("trimesterId")
        .populate("courseId");
      if (!cohort) {
        return res.status(404).json({
          error: "Cohort not found",
          code: "COHORT_NOT_FOUND",
        });
      }
    } else {
      // Auto-resolve user's most recent active/enrolling cohort
      const userId = req.user._id;
      const isInstructor = req.user.role === "tutor" || req.user.role === "instructor";
      const filter = isInstructor
        ? { instructorIds: userId }
        : { studentIds: userId };

      cohort = await Cohort.findOne(filter)
        .sort({ updatedAt: -1, createdAt: -1 })
        .populate("trimesterId")
        .populate("courseId");
    }

    if (!cohort) {
      return res.status(403).json({
        error: "You are not enrolled in this cohort",
        code: "COHORT_ACCESS_DENIED",
      });
    }

    // Role-based membership verification
    const userRole = req.user.role;
    const userIdStr = String(req.user._id);

    if (userRole === "admin") {
      req.cohort = cohort;
      req.cohortId = cohort._id;
      return next();
    }

    const isStudentEnrolled =
      cohort.studentIds &&
      cohort.studentIds.some((id) => String(id) === userIdStr);
    const isInstructorAssigned =
      cohort.instructorIds &&
      cohort.instructorIds.some((id) => String(id) === userIdStr);

    if (userRole === "student" && !isStudentEnrolled) {
      return res.status(403).json({
        error: "You are not enrolled in this cohort",
        code: "COHORT_ACCESS_DENIED",
      });
    }

    if (
      (userRole === "tutor" || userRole === "instructor") &&
      !isInstructorAssigned &&
      !isStudentEnrolled
    ) {
      return res.status(403).json({
        error: "You are not enrolled in this cohort",
        code: "COHORT_ACCESS_DENIED",
      });
    }

    req.cohort = cohort;
    req.cohortId = cohort._id;
    next();
  } catch (error) {
    next(error);
  }
};

export default cohortGuard;
