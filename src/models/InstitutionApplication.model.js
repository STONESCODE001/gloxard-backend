import mongoose, { Schema } from "mongoose";

const documentSchema = new Schema(
  {
    name: { type: String, required: true, trim: true },
    key: { type: String, required: true, trim: true },
    size: { type: Number, default: 0 },
    verifiedAt: { type: Date, default: null },
  },
  { _id: true }
);

const institutionApplicationSchema = new Schema(
  {
    referenceId: {
      type: String,
      unique: true,
      required: true,
      index: true,
      trim: true,
    },
    institutionName: {
      type: String,
      required: [true, "Institution name is required"],
      trim: true,
    },
    type: {
      type: String,
      required: [true, "Institution type is required"],
      enum: [
        "Private University",
        "Vocational School",
        "Charter School",
        "Medical Institute",
        "Public College",
        "International School",
        "Technical College",
        "Business School",
        "Law School",
        "Online University",
        "Tertiary Institution",
        "Other",
      ],
    },
    website: {
      type: String,
      trim: true,
      default: "",
    },
    address: {
      line1: { type: String, trim: true, default: "" },
      city: { type: String, trim: true, default: "" },
      country: { type: String, trim: true, default: "NG" },
    },
    representative: {
      name: { type: String, required: [true, "Representative name is required"], trim: true },
      role: { type: String, required: [true, "Representative role is required"], trim: true },
      email: {
        type: String,
        required: [true, "Representative email is required"],
        lowercase: true,
        trim: true,
        index: true,
      },
      phone: { type: String, required: [true, "Representative phone number is required"], trim: true },
    },
    expectedStudents: {
      type: String,
      default: "",
      trim: true,
    },
    expectedStudentsCount: {
      type: Number,
      default: 0,
    },
    requestedFeatures: {
      type: String,
      default: "",
      trim: true,
    },
    message: {
      type: String,
      default: "",
      trim: true,
    },
    documents: [documentSchema],
    status: {
      type: String,
      enum: ["pending", "under_review", "approved", "rejected"],
      default: "pending",
      index: true,
    },
    plan: {
      type: String,
      enum: ["Premium", "Enterprise"],
      default: "Premium",
    },
    internalNotes: {
      type: String,
      default: "",
    },
    accessCode: {
      type: String,
      default: "",
    },
    submittedAt: {
      type: Date,
      default: Date.now,
      index: true,
    },
    reviewedBy: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    updatedBy: {
      type: String,
      default: "",
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

// Compound index for duplicate pending detection
institutionApplicationSchema.index({ "representative.email": 1, status: 1 });

// Auto-generate referenceId before validation if not present
institutionApplicationSchema.pre("validate", function (next) {
  if (!this.referenceId) {
    const year = new Date().getFullYear();
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    this.referenceId = `GLX-${year}-${randomSuffix}`;
  }
  if (typeof next === "function") {
    return next();
  }
});

export const InstitutionApplication =
  mongoose.models.InstitutionApplication ||
  mongoose.model("InstitutionApplication", institutionApplicationSchema, "institutionapplications");

export default InstitutionApplication;
