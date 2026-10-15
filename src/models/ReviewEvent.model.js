import mongoose, { Schema } from "mongoose";

const reviewEventSchema = new Schema(
  {
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "InstitutionApplication",
      required: true,
      index: true,
    },
    actorId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    actorName: {
      type: String,
      required: true,
      trim: true,
    },
    action: {
      type: String,
      required: true,
      enum: [
        "status_change",
        "plan_change",
        "note",
        "approve",
        "reject",
        "request_info",
        "invite_sent",
      ],
    },
    from: {
      type: Schema.Types.Mixed,
      default: null,
    },
    to: {
      type: Schema.Types.Mixed,
      default: null,
    },
    note: {
      type: String,
      default: "",
    },
    createdAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
  },
  {
    timestamps: false,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        delete ret.id;
        return ret;
      },
    },
    toObject: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        delete ret.id;
        return ret;
      },
    },
  }
);

export const ReviewEvent =
  mongoose.models.ReviewEvent ||
  mongoose.model("ReviewEvent", reviewEventSchema, "reviewevents");

export default ReviewEvent;
