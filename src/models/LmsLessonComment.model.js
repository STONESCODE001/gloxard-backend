import mongoose, { Schema } from "mongoose";

const LmsLessonCommentSchema = new Schema(
  {
    lessonId: {
      type: Schema.Types.ObjectId,
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
    },
    authorRole: {
      type: String,
      default: "student",
    },
    body: {
      type: String,
      required: true,
      trim: true,
    },
    likes: [
      {
        type: Schema.Types.ObjectId,
        ref: "User",
      },
    ],
    parentId: {
      type: Schema.Types.ObjectId,
      ref: "LmsLessonComment",
      default: null,
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const LmsLessonComment = mongoose.model(
  "LmsLessonComment",
  LmsLessonCommentSchema
);
export default LmsLessonComment;
