import mongoose, { Schema } from "mongoose";

const LmsPollSchema = new Schema(
  {
    sessionId: {
      type: Schema.Types.ObjectId,
      ref: "LmsLiveSession",
      required: true,
      index: true,
    },
    question: {
      type: String,
      required: true,
      trim: true,
    },
    options: [
      {
        type: String,
        required: true,
        trim: true,
      },
    ],
    votes: [
      {
        userId: {
          type: Schema.Types.ObjectId,
          ref: "User",
          required: true,
        },
        optionIndex: {
          type: Number,
          required: true,
        },
      },
    ],
    status: {
      type: String,
      enum: ["open", "closed"],
      default: "open",
      index: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  },
  {
    timestamps: true,
    collection: "lmspolls",
  }
);

export const LmsPoll = mongoose.model("LmsPoll", LmsPollSchema);
export default LmsPoll;
