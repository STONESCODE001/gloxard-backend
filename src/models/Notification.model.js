import mongoose, { Schema } from 'mongoose';

const notificationSchema = new Schema(
  {
    recipient: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    targetRole: { type: String, enum: ['all', 'student', 'instructor'], default: null },
    title: { type: String, required: true, trim: true },
    message: { type: String, required: true, trim: true },
    type: { type: String, default: 'system_broadcast' },
    read: { type: Boolean, default: false },
    link: { type: String, default: null }
  },
  {
    timestamps: true,
    toJSON: {
      virtuals: true,
      transform: function (doc, ret) {
        delete ret.__v;
        return ret;
      }
    }
  }
);

export const Notification = mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export default Notification;
