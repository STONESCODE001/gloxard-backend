import mongoose, { Schema } from "mongoose";

const LmsReplySchema = new Schema(
  {
    postId: {
      type: Schema.Types.ObjectId,
      ref: "LmsPost",
      required: true,
      index: true,
    },
    authorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true,
    },
    body: {
      type: String,
      required: true,
      maxlength: 5000,
      trim: true,
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: true,
    collection: "lmsreplies",
  }
);

export const LmsReply = mongoose.model("LmsReply", LmsReplySchema);
export default LmsReply;
