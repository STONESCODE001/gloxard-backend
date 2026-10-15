import mongoose, { Schema } from "mongoose";

const LmsChannelSchema = new Schema(
  {
    cohortId: {
      type: Schema.Types.ObjectId,
      ref: "Cohort",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      trim: true,
    },
    postCount: {
      type: Number,
      default: 0,
    },
    isNew: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    collection: "lmschannels",
    suppressReservedKeysWarning: true,
  }
);

LmsChannelSchema.index({ cohortId: 1, slug: 1 }, { unique: true });

export const LmsChannel = mongoose.model("LmsChannel", LmsChannelSchema);
export default LmsChannel;
