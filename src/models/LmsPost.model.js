import mongoose, { Schema } from "mongoose";

const LmsPostSchema = new Schema(
  {
    channelId: {
      type: Schema.Types.ObjectId,
      ref: "LmsChannel",
      required: true,
      index: true,
    },
    cohortId: {
      type: Schema.Types.ObjectId,
      ref: "Cohort",
      required: true,
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    tag: {
      type: String,
      enum: ["Discussion", "Showcase", "Q&A"],
      default: "Discussion",
      index: true,
    },
    title: {
      type: String,
      required: true,
      maxlength: 120,
      trim: true,
    },
    body: {
      type: String,
      required: true,
      maxlength: 5000,
      trim: true,
    },
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    likesCount: {
      type: Number,
      default: 0,
    },
    repliesCount: {
      type: Number,
      default: 0,
    },
    isReported: {
      type: Boolean,
      default: false,
      index: true,
    },
    isDeleted: {
      type: Boolean,
      default: false,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "lmsposts",
  }
);

export const LmsPost = mongoose.model("LmsPost", LmsPostSchema);
export default LmsPost;
