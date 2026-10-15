import mongoose, { Schema } from "mongoose";

const LmsAssignmentSchema = new Schema(
  {
    cohortId: {
      type: Schema.Types.ObjectId,
      ref: "Cohort",
      required: true,
      index: true,
    },
    moduleId: {
      type: Schema.Types.ObjectId,
      required: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    summary: {
      type: String,
      default: "",
      trim: true,
    },
    description: {
      type: String,
      required: true,
    },
    dueAt: {
      type: Date,
      required: true,
      index: true,
    },
    rubric: [
      {
        criterion: {
          type: String,
          required: true,
        },
        points: {
          type: Number,
          required: true,
        },
      },
    ],
    maxFileMB: {
      type: Number,
      default: 50,
    },
    allowedTypes: [
      {
        type: String,
        default: ["zip", "pdf"],
      },
    ],
    allowRepoLink: {
      type: Boolean,
      default: true,
    },
    allowLate: {
      type: Boolean,
      default: true,
    },
    latePenaltyPercent: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
  }
);

export const LmsAssignment = mongoose.model(
  "LmsAssignment",
  LmsAssignmentSchema
);
export default LmsAssignment;
