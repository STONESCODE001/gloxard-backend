import mongoose, { Schema } from "mongoose";

const LmsQuizAttemptSchema = new Schema(
  {
    cohortId: {
      type: Schema.Types.ObjectId,
      ref: "Cohort",
      required: true,
      index: true,
    },
    quizId: {
      type: Schema.Types.ObjectId,
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    attemptNumber: {
      type: Number,
      required: true,
      default: 1,
    },
    startedAt: {
      type: Date,
      default: Date.now,
    },
    expiresAt: {
      type: Date,
      required: true,
    },
    answers: [
      {
        questionId: {
          type: Schema.Types.ObjectId,
          required: true,
        },
        optionId: {
          type: String,
        },
        flagged: {
          type: Boolean,
          default: false,
        },
        checkedAt: {
          type: Date,
          default: null,
        },
        isCorrect: {
          type: Boolean,
          default: false,
        },
      },
    ],
    score: {
      type: Number,
      default: 0,
    },
    total: {
      type: Number,
      default: 0,
    },
    percent: {
      type: Number,
      default: 0,
    },
    passed: {
      type: Boolean,
      default: false,
    },
    status: {
      type: String,
      enum: ["in_progress", "submitted", "expired"],
      default: "in_progress",
      index: true,
    },
    submittedAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

// Index for rapid lookup of student attempts on a quiz in a cohort
LmsQuizAttemptSchema.index({ cohortId: 1, quizId: 1, userId: 1 });

export const LmsQuizAttempt = mongoose.model(
  "LmsQuizAttempt",
  LmsQuizAttemptSchema
);
export default LmsQuizAttempt;
