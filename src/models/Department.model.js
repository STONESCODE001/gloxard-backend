import mongoose, { Schema } from "mongoose";

const departmentSchema = new Schema(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
      index: true,
    },
    name: {
      type: String,
      required: [true, "Department name is required"],
      trim: true,
    },
    code: {
      type: String,
      required: [true, "Department code is required"],
      trim: true,
      uppercase: true,
    },
    faculty: {
      type: String,
      trim: true,
      default: "",
    },
    headName: {
      type: String,
      trim: true,
      default: "",
    },
    headUserId: {
      type: Schema.Types.ObjectId,
      ref: "User",
      default: null,
    },
    description: {
      type: String,
      trim: true,
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

// Compound unique index: code must be unique within an institution
departmentSchema.index({ institutionId: 1, code: 1 }, { unique: true });

export const Department =
  mongoose.models.Department ||
  mongoose.model("Department", departmentSchema, "departments");

export default Department;
