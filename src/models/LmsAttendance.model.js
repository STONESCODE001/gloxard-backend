import mongoose, { Schema } from "mongoose";

const LmsAttendanceSchema = new Schema(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "LmsLiveSession",
      required: true,
      index: true,
    },
    cohortId: {
      type: Schema.Types.ObjectId,
      ref: "Cohort",
      required: true,
      index: true,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    status: {
      type: String,
      enum: ["present", "absent", "excused"],
      default: "absent",
      index: true,
    },
    joinedAt: {
      type: Date,
      default: null,
    },
    leftAt: {
      type: Date,
      default: null,
    },
    durationMinutes: {
      type: Number,
      default: 0,
    },
  },
  {
    timestamps: true,
    collection: "lmsattendances",
  }
);

LmsAttendanceSchema.index({ sessionId: 1, userId: 1 }, { unique: true });

export const LmsAttendance = mongoose.model("LmsAttendance", LmsAttendanceSchema);
export default LmsAttendance;
