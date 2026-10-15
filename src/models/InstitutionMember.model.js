import mongoose, { Schema } from "mongoose";

const institutionMemberSchema = new Schema(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
      index: true,
    },
    role: {
      type: String,
      required: [true, "Member role is required"],
      enum: ["tutor", "student"],
      index: true,
    },
    name: {
      type: String,
      required: [true, "Member name is required"],
      trim: true,
    },
    email: {
      type: String,
      required: [true, "Member email is required"],
      lowercase: true,
      trim: true,
    },
    departmentIds: [
      {
        type: Schema.Types.ObjectId,
        ref: "Department",
      },
    ],
    designation: {
      type: String,
      trim: true,
      default: "",
    },
    autoInvite: {
      type: Boolean,
      default: false,
    },
    inviteStatus: {
      type: String,
      enum: ["not_invited", "pending", "accepted", "expired"],
      default: "not_invited",
      index: true,
    },
    inviteToken: {
      type: String,
      default: null,
    },
    invitedAt: {
      type: Date,
      default: null,
    },
    userId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
      index: true,
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

// Compound unique index: email must be unique per institution
institutionMemberSchema.index({ institutionId: 1, email: 1 }, { unique: true });
institutionMemberSchema.index({ institutionId: 1, role: 1 });

export const InstitutionMember =
  mongoose.models.InstitutionMember ||
  mongoose.model("InstitutionMember", institutionMemberSchema, "institutionmembers");

export default InstitutionMember;
