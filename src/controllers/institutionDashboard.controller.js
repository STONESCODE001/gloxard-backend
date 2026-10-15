import { InstitutionMember } from "../models/InstitutionMember.model.js";
import { Department } from "../models/Department.model.js";
import { Institution } from "../models/Institution.model.js";
import { Subscription } from "../models/Subscription.model.js";

/**
 * GET /api/institutions/me/dashboard
 * Aggregates live tenant data: students, tutors, active departments, seat utilization,
 * growth metrics, and recent workspace activity.
 */
export const getInstitutionDashboard = async (req, res, next) => {
  try {
    const institution = await Institution.findById(req.institutionId);
    if (!institution) {
      return res.status(404).json({
        error: "Institution workspace not found",
        code: "INSTITUTION_NOT_FOUND",
      });
    }

    const seatLimit = institution.seatLimit || (institution.plan === "Enterprise" ? 5000 : 500);

    const [totalStudents, totalTutors, activeDepartments, subscription, recentMembers, recentDepartments] =
      await Promise.all([
        InstitutionMember.countDocuments({ institutionId: req.institutionId, role: "student" }),
        InstitutionMember.countDocuments({ institutionId: req.institutionId, role: "tutor" }),
        Department.countDocuments({ institutionId: req.institutionId }),
        Subscription.findOne({ institutionId: req.institutionId }),
        InstitutionMember.find({ institutionId: req.institutionId })
          .sort({ createdAt: -1 })
          .limit(5)
          .select("name email role designation createdAt"),
        Department.find({ institutionId: req.institutionId })
          .sort({ createdAt: -1 })
          .limit(5)
          .select("name code faculty createdAt"),
      ]);

    const seatUtilization = seatLimit > 0 ? Math.round((totalStudents / seatLimit) * 100) : 0;

    // Build recent activity stream
    const recentActivity = [
      ...recentMembers.map((m) => ({
        type: "member_added",
        title: `New ${m.role === "tutor" ? "Faculty Tutor" : "Student"}: ${m.name}`,
        subtitle: m.email,
        timestamp: m.createdAt,
      })),
      ...recentDepartments.map((d) => ({
        type: "department_created",
        title: `Department Created: ${d.name} (${d.code})`,
        subtitle: d.faculty || "Department",
        timestamp: d.createdAt,
      })),
    ].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp)).slice(0, 8);

    // Build weekly activity progression (last 7 days)
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
    const weeklyAdditions = await InstitutionMember.aggregate([
      {
        $match: {
          institutionId: institution._id,
          createdAt: { $gte: sevenDaysAgo },
        },
      },
      {
        $group: {
          _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    return res.status(200).json({
      metrics: {
        totalStudents,
        totalTeachers: totalTutors,
        totalTutors,
        activeDepartments,
        seatUtilization,
        seatLimit,
        plan: institution.plan,
        status: institution.status,
        subscriptionStatus: subscription ? subscription.status : "incomplete",
      },
      recentActivity,
      weeklyActivity: weeklyAdditions,
      institution: {
        _id: institution._id,
        name: institution.name,
        slug: institution.slug,
        branding: institution.branding,
        onboarding: institution.onboarding,
      },
    });
  } catch (error) {
    next(error);
  }
};

export default {
  getInstitutionDashboard,
};
