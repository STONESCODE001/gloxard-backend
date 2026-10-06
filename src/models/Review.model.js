import mongoose, { Schema } from "mongoose";
import Course from "./Course.model.js";

const tutorReplySchema = new Schema(
  {
    comment: { type: String, default: "", trim: true },
    createdAt: { type: Date, default: null }
  },
  {
    _id: false,
    toJSON: { virtuals: true },
    toObject: { virtuals: true }
  }
);

tutorReplySchema.virtual("text").get(function () {
  return this.comment;
});

const reviewSchema = new Schema(
  {
    course: {
      type: Schema.Types.ObjectId,
      ref: "Course",
      required: [true, "Course reference is required"],
      index: true
    },
    student: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: [true, "Student reference is required"],
      index: true
    },
    rating: {
      type: Number,
      required: [true, "Rating is required"],
      min: [1, "Rating must be at least 1"],
      max: [5, "Rating cannot exceed 5"]
    },
    comment: {
      type: String,
      required: [true, "Review comment is required"],
      trim: true
    },
    tutorReply: {
      type: tutorReplySchema,
      default: () => ({ comment: "", createdAt: null })
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        delete ret.id;
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        delete ret.id;
        return ret;
      }
    }
  }
);

reviewSchema.virtual("reviewText").get(function () {
  return this.comment;
});

// Prevent duplicate reviews from the same student for the same course
reviewSchema.index({ course: 1, student: 1 }, { unique: true });

/**
 * Static method to recalculate course average rating and ratingsCount
 */
reviewSchema.statics.recalculateCourseRating = async function (courseId) {
  try {
    const objectId = new mongoose.Types.ObjectId(courseId);
    const stats = await this.aggregate([
      { $match: { course: objectId } },
      {
        $group: {
          _id: "$course",
          averageRating: { $avg: "$rating" },
          count: { $sum: 1 }
        }
      }
    ]);

    const average = stats.length > 0 ? Math.round(stats[0].averageRating * 10) / 10 : 0;
    const count = stats.length > 0 ? stats[0].count : 0;

    await Course.findByIdAndUpdate(courseId, {
      $set: {
        "rating.average": average,
        "rating.count": count,
        ratingsCount: count
      }
    });

    return { average, count };
  } catch (error) {
    console.error(`[Review.model] Failed to recalculate rating for course ${courseId}:`, error);
    throw error;
  }
};

export const Review = mongoose.models.Review || mongoose.model("Review", reviewSchema);
export default Review;
