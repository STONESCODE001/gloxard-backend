import mongoose, { Schema } from 'mongoose';

const enrollmentSchema = new Schema(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    course: { type: Schema.Types.ObjectId, ref: 'Course', required: true, index: true },
    price: { type: Number, default: 0 },
    status: { type: String, enum: ['active', 'completed', 'cancelled'], default: 'active' }
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

export const Enrollment = mongoose.models.Enrollment || mongoose.model('Enrollment', enrollmentSchema);
export default Enrollment;
