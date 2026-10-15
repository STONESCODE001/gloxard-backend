import mongoose, { Schema } from "mongoose";

const invoiceSchema = new Schema(
  {
    invoiceId: { type: String, required: true },
    amount: { type: Number, required: true },
    currency: { type: String, default: "USD" },
    paidAt: { type: Date, default: Date.now },
    status: { type: String, default: "paid" },
    receiptUrl: { type: String, default: "" },
  },
  { _id: false }
);

const subscriptionSchema = new Schema(
  {
    institutionId: {
      type: Schema.Types.ObjectId,
      ref: "Institution",
      required: true,
      unique: true,
      index: true,
    },
    plan: {
      type: String,
      required: true,
      enum: ["Premium", "Enterprise"],
    },
    billing: {
      type: String,
      required: true,
      enum: ["monthly", "annual"],
    },
    currency: {
      type: String,
      required: true,
      enum: ["USD", "NGN"],
      default: "USD",
    },
    amountGross: {
      type: Number,
      required: true,
    },
    discount: {
      type: Number,
      default: 0,
    },
    amountTotal: {
      type: Number,
      required: true,
    },
    taxAmount: {
      type: Number,
      default: 0,
    },
    status: {
      type: String,
      enum: ["active", "past_due", "canceled", "incomplete"],
      default: "incomplete",
      index: true,
    },
    provider: {
      type: String,
      default: "paystack",
    },
    providerReference: {
      type: String,
      default: "",
      index: true,
    },
    paystackSubscriptionCode: {
      type: String,
      default: "",
    },
    paystackEmailToken: {
      type: String,
      default: "",
    },
    periodStart: {
      type: Date,
      default: Date.now,
    },
    periodEnd: {
      type: Date,
    },
    invoices: [invoiceSchema],
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

export const Subscription =
  mongoose.models.Subscription ||
  mongoose.model("Subscription", subscriptionSchema, "subscriptions");

export default Subscription;
