import mongoose, { Schema } from "mongoose";

const LmsLiveSessionSchema = new Schema(
  {
    cohortId: {
      type: Schema.Types.ObjectId,
      ref: "Cohort",
      required: true,
      index: true,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      default: "",
      trim: true,
    },
    instructorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    startsAt: {
      type: Date,
      required: true,
      index: true,
    },
    endsAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["scheduled", "live", "ended"],
      default: "scheduled",
      index: true,
    },
    provider: {
      type: String,
      default: "livekit",
    },
    roomName: {
      type: String,
      required: true,
      unique: true,
      trim: true,
    },
    recordingUrl: {
      type: String,
      default: "",
      trim: true,
    },
  },
  {
    timestamps: true,
    collection: "lmslivesessions",
  }
);

export const LmsLiveSession = mongoose.model("LmsLiveSession", LmsLiveSessionSchema);
export default LmsLiveSession;
