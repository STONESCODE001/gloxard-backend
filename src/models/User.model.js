import mongoose, { Schema } from "mongoose";
import bcrypt from "bcryptjs";

const socialsSchema = new Schema(
  {
    website: { type: String, default: "" },
    facebook: { type: String, default: "" },
    instagram: { type: String, default: "" },
    linkedin: { type: String, default: "" },
    twitter: { type: String, default: "" },
    whatsapp: { type: String, default: "" },
    youtube: { type: String, default: "" },
  },
  { _id: false }
);

const notificationPreferencesSchema = new Schema(
  {
    coursePurchases: { type: Boolean, default: true },
    courseReviews: { type: Boolean, default: true },
    lectureComments: { type: Boolean, default: true },
    lectureNotesDownloads: { type: Boolean, default: true },
    commentReplies: { type: Boolean, default: true },
    dailyProfileVisits: { type: Boolean, default: true },
    lectureFileDownloads: { type: Boolean, default: true },
  },
  { _id: false }
);

const userSchema = new Schema(
  {
    firstName: {
      type: String,
      required: [true, "First name is required"],
      trim: true,
    },
    lastName: {
      type: String,
      trim: true,
      default: "",
    },
    name: {
      type: String,
      trim: true,
    },
    username: {
      type: String,
      unique: true,
      sparse: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    email: {
      type: String,
      required: [true, "Email is required"],
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    password: {
      type: String,
      required: [true, "Password is required"],
    },
    role: {
      type: String,
      enum: ["student", "instructor", "admin"],
      default: "student",
    },
    approvalStatus: {
      type: String,
      enum: ["pending", "approved", "rejected"],
      default: "approved",
    },
    isVerified: {
      type: Boolean,
      default: false,
    },
    isActive: {
      type: Boolean,
      default: true,
    },
    avatarUrl: {
      type: String,
      default: "",
    },
    bio: {
      type: String,
      default: "",
    },
    socials: {
      type: socialsSchema,
      default: () => ({}),
    },
    notificationPreferences: {
      type: notificationPreferencesSchema,
      default: () => ({}),
    },
    lastLoginAt: {
      type: Date,
      default: null,
    },
  },
  {
    timestamps: true,
    toJSON: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
    toObject: {
      transform: function (doc, ret) {
        delete ret.password;
        delete ret.__v;
        return ret;
      },
    },
  }
);

// Pre-save hook: auto-compute full name and default approvalStatus for instructors
userSchema.pre("save", async function () {
  if (this.isModified("firstName") || this.isModified("lastName") || !this.name) {
    this.name = `${this.firstName || ""} ${this.lastName || ""}`.trim();
  }

  if (this.isNew && this.role === "instructor" && !this.isModified("approvalStatus")) {
    this.approvalStatus = "pending";
  }

  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
});

// Method to compare entered password with hashed password
userSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password);
};

export const User = mongoose.model("User", userSchema);
export default User;