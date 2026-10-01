import mongoose from "mongoose";
import { User } from "../models/User.model.js";
import { Course } from "../models/Course.model.js";

/**
 * @desc    Submit tutor qualification credentials for admin verification & upgrade student role to instructor
 * @route   POST /api/tutor/showcase-expertise
 * @access  Private (Student or Instructor)
 */
export const showcaseExpertiseController = async (req, res, next) => {
  try {
    const {
      title,
      areaOfExpertise,
      experienceYears,
      expertiseBio,
      university,
      skills,
      certificationsUrl,
      certifications,
    } = req.body || {};

    if (!areaOfExpertise || !expertiseBio || !areaOfExpertise.trim() || !expertiseBio.trim()) {
      return res.status(400).json({
        error: "Area of expertise and expertise bio are required",
      });
    }

    const updateFields = {
      areaOfExpertise: areaOfExpertise.trim(),
      expertiseBio: expertiseBio.trim(),
      approvalStatus: "pending",
    };

    if (title !== undefined) updateFields.title = String(title).trim();
    if (experienceYears !== undefined) updateFields.experienceYears = Number(experienceYears) || 0;
    if (university !== undefined) updateFields.university = String(university).trim();
    if (certificationsUrl !== undefined) updateFields.certificationsUrl = String(certificationsUrl).trim();

    if (skills !== undefined) {
      updateFields.skills = Array.isArray(skills) ? skills.map((s) => String(s).trim()) : [];
    }

    if (certifications !== undefined) {
      updateFields.certifications = Array.isArray(certifications)
        ? certifications.map((c) => String(c).trim())
        : [];
    }

    // Upgrade role to instructor if caller is currently a student
    if (req.user.role === "student") {
      updateFields.role = "instructor";
    }

    // Non-destructive update preserving existing user attributes and _id
    const updatedUser = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updateFields },
      { new: true, runValidators: true }
    );

    return res.status(200).json({
      message:
        "Tutor expertise showcase submitted successfully and is currently under administrative review",
      user: updatedUser,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get aggregated performance stats for authenticated instructor
 * @route   GET /api/tutor/dashboard-stats
 * @access  Private (Instructor)
 */
export const getDashboardStatsController = async (req, res, next) => {
  try {
    const instructorId = req.user._id;

    // Fetch all courses owned by this instructor
    const courses = await Course.find({ instructor: instructorId });

    const totalCourses = courses.length;
    const publishedCourses = courses.filter((c) => c.status === "published").length;
    const pendingCourses = courses.filter((c) => c.status === "pending").length;
    const draftCourses = courses.filter((c) => c.status === "draft").length;

    let totalStudents = 0;
    let totalRevenue = 0;
    let totalReviews = 0;
    let weightedRatingSum = 0;

    courses.forEach((c) => {
      totalStudents += c.enrolledCount || 0;
      const coursePrice = c.discountPrice > 0 ? c.discountPrice : c.price || 0;
      totalRevenue += (c.enrolledCount || 0) * coursePrice;

      if (c.rating) {
        const count = c.rating.count || 0;
        const avg = c.rating.average || 0;
        totalReviews += count;
        weightedRatingSum += avg * count;
      }
    });

    let averageRating = 0;
    if (totalReviews > 0) {
      averageRating = Math.round((weightedRatingSum / totalReviews) * 100) / 100;
    } else {
      const publishedWithRating = courses.filter((c) => c.status === "published" && c.rating && c.rating.average > 0);
      if (publishedWithRating.length > 0) {
        const sum = publishedWithRating.reduce((acc, curr) => acc + curr.rating.average, 0);
        averageRating = Math.round((sum / publishedWithRating.length) * 100) / 100;
      }
    }

    // Check if Transaction or Enrollment model exists in Mongoose for richer dynamic aggregation
    if (mongoose.models.Transaction) {
      try {
        const courseIds = courses.map((c) => c._id);
        const txStats = await mongoose.models.Transaction.aggregate([
          { $match: { course: { $in: courseIds }, status: "success" } },
          { $group: { _id: null, totalRevenue: { $sum: "$amount" } } },
        ]);
        if (txStats.length > 0 && txStats[0].totalRevenue > 0) {
          totalRevenue = txStats[0].totalRevenue;
        }
      } catch (err) {
        // Fallback to computed totalRevenue
      }
    }

    return res.status(200).json({
      totalCourses,
      publishedCourses,
      pendingCourses,
      draftCourses,
      totalStudents,
      averageRating,
      totalReviews,
      totalRevenue,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get detailed financial breakdown & revenue share balance for authenticated instructor
 * @route   GET /api/tutor/earnings
 * @access  Private (Instructor)
 */
export const getEarningsController = async (req, res, next) => {
  try {
    const instructorId = req.user._id;

    // Fetch courses owned by instructor
    const courses = await Course.find({ instructor: instructorId });

    let grossRevenue = 0;
    courses.forEach((c) => {
      const price = c.discountPrice > 0 ? c.discountPrice : c.price || 0;
      grossRevenue += (c.enrolledCount || 0) * price;
    });

    let monthlyBreakdown = [];
    let recentTransactions = [];

    // If Transaction model exists, use actual transactions if available
    if (mongoose.models.Transaction) {
      try {
        const courseIds = courses.map((c) => c._id);
        const successfulTxs = await mongoose.models.Transaction.find({
          course: { $in: courseIds },
          status: "success",
        })
          .sort({ createdAt: -1 })
          .populate("course", "title")
          .populate("user", "name firstName lastName");

        if (successfulTxs.length > 0) {
          grossRevenue = successfulTxs.reduce((sum, tx) => sum + (tx.amount || 0), 0);

          recentTransactions = successfulTxs.slice(0, 10).map((tx) => ({
            _id: tx._id,
            courseTitle: tx.course?.title || "Course Purchase",
            studentName:
              tx.user?.name ||
              `${tx.user?.firstName || ""} ${tx.user?.lastName || ""}`.trim() ||
              "Student",
            amount: tx.amount || 0,
            instructorShare: Math.round((tx.amount || 0) * 0.8),
            status: tx.status,
            createdAt: tx.createdAt,
          }));

          // Monthly aggregation
          const monthMap = {};
          successfulTxs.forEach((tx) => {
            const monthStr = new Date(tx.createdAt).toISOString().slice(0, 7);
            if (!monthMap[monthStr]) {
              monthMap[monthStr] = { grossRevenue: 0, enrollments: 0 };
            }
            monthMap[monthStr].grossRevenue += tx.amount || 0;
            monthMap[monthStr].enrollments += 1;
          });

          monthlyBreakdown = Object.keys(monthMap)
            .sort()
            .map((month) => ({
              month,
              grossRevenue: monthMap[month].grossRevenue,
              instructorEarnings: Math.round(monthMap[month].grossRevenue * 0.8),
              enrollments: monthMap[month].enrollments,
            }));
        }
      } catch (err) {
        // Fallback calculation below
      }
    }

    const totalEarnings = Math.round(grossRevenue * 0.8);
    const withdrawableBalance = Math.round(totalEarnings * 0.75);
    const pendingBalance = totalEarnings - withdrawableBalance;
    const revenueSharePercentage = 80;

    return res.status(200).json({
      totalEarnings,
      withdrawableBalance,
      pendingBalance,
      revenueSharePercentage,
      monthlyBreakdown,
      recentTransactions,
    });
  } catch (error) {
    next(error);
  }
};
