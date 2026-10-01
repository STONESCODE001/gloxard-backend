import mongoose from "mongoose";

const appealSchema = new mongoose.Schema(
  {
    courseId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Course",
      required: true,
      index: true
    },
    instructorId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
      index: true
    },
    message: {
      type: String,
      required: true,
      trim: true
    },
    status: {
      type: String,
      enum: ["pending", "resolved"],
      default: "pending",
      index: true
    },
    adminNotes: {
      type: String,
      default: ""
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      }
    }
  }
);

export const Appeal = mongoose.model("Appeal", appealSchema);
export default Appeal;
