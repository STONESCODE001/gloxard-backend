import mongoose, { Schema } from "mongoose";

const institutionSchema = new Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
    },
    slug: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    logoUrl: {
      type: String,
      default: "",
    },
    branding: {
      displayName: { type: String, default: "" },
      color: { type: String, default: "#4F46E5" },
      tagline: { type: String, default: "" },
    },
    plan: {
      type: String,
      enum: ["Premium", "Enterprise"],
      default: "Premium",
    },
    billing: {
      type: String,
      enum: ["monthly", "annual"],
      default: "monthly",
    },
    status: {
      type: String,
      enum: ["pending_activation", "onboarding", "active", "suspended"],
      default: "pending_activation",
      index: true,
    },
    adminUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    representativeEmail: {
      type: String,
      required: true,
      lowercase: true,
      trim: true,
    },
    applicationId: {
      type: Schema.Types.ObjectId,
      ref: "InstitutionApplication",
      unique: true,
      index: true,
      required: true,
    },
    activationToken: {
      type: String,
      index: true,
    },
    activationExpiresAt: {
      type: Date,
      required: true,
    },
    activationUsed: {
      type: Boolean,
      default: false,
    },
    onboarding: {
      currentStep: {
        type: Number,
        default: 1,
      },
      completedSteps: {
        type: [Number],
        default: [],
      },
    },
    seatLimit: {
      type: Number,
      default: 500,
    },
  },
  {
    timestamps: true,
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

export const Institution =
  mongoose.models.Institution ||
  mongoose.model("Institution", institutionSchema, "institutions");

export default Institution;
