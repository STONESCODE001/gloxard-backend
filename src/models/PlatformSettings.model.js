import mongoose, { Schema } from "mongoose";

const platformSettingsSchema = new Schema(
  {
    allowSignups: {
      type: Boolean,
      default: true
    },
    allowPasswordReset: {
      type: Boolean,
      default: true
    },
    deletionGraceDays: {
      type: Number,
      default: 30
    },
    signatureUrl: {
      type: String,
      default: "",
      trim: true
    }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        delete ret.id;
        return ret;
      }
    },
    toObject: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        delete ret.id;
        return ret;
      }
    }
  }
);

/**
 * Singleton retrieval/creation helper
 */
platformSettingsSchema.statics.getOrCreateSettings = async function () {
  let settings = await this.findOne();
  if (!settings) {
    settings = await this.create({});
  }
  return settings;
};

export const PlatformSettings =
  mongoose.models.PlatformSettings ||
  mongoose.model("PlatformSettings", platformSettingsSchema);

export default PlatformSettings;
