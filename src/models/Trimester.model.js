import mongoose, { Schema } from "mongoose";

const TrimesterSchema = new Schema(
  {
    number: {
      type: Number,
      required: true,
      enum: [1, 2, 3],
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },
    weeks: {
      type: Number,
      required: true,
      default: 12,
    },
    enrollmentClosesAt: {
      type: Date,
      required: true,
    },
    status: {
      type: String,
      enum: ["upcoming", "active", "completed"],
      default: "upcoming",
      index: true,
    },
  },
  {
    timestamps: true,
  }
);

export const Trimester = mongoose.model("Trimester", TrimesterSchema);
export default Trimester;
