import mongoose, { Schema, InferSchemaType } from 'mongoose';

/**
 * Application users: students, teachers and school admins.
 * Individual learners have no schoolId; school members are scoped to one
 * school/coaching centre by schoolId.
 */
const userSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 80 },
    email: {
      type: String,
      required: true,
      unique: true,
      lowercase: true,
      trim: true,
      index: true,
    },
    passwordHash: { type: String, required: true, select: false },
    avatarUrl: { type: String, default: null },
    role: {
      type: String,
      enum: ['user', 'student', 'teacher', 'school_admin', 'admin'],
      default: 'student',
      index: true,
    },
    schoolId: {
      type: Schema.Types.ObjectId,
      ref: 'School',
      default: null,
      index: true,
    },
    classLevel: { type: Number, min: 1, max: 10, default: null, index: true },
    phone: { type: String, default: '' },
    designation: { type: String, default: '' },
    subjects: { type: [String], default: [] },
    assignedClasses: { type: [Number], default: [] },
    studentRoll: { type: String, default: '' },
    guardianName: { type: String, default: '' },
    guardianPhone: { type: String, default: '' },
    mustChangePassword: { type: Boolean, default: false },
    createdBy: { type: Schema.Types.ObjectId, default: null },
    isActive: { type: Boolean, default: true },
    lastLoginAt: { type: Date, default: null },
    resetPasswordToken: { type: String, default: null, select: false },
    resetPasswordExpires: { type: Date, default: null, select: false },
  },
  { timestamps: true, collection: 'users' }
);

userSchema.index({ createdAt: -1 });
userSchema.index({ role: 1, createdAt: -1 });
userSchema.index({ schoolId: 1, role: 1, createdAt: -1 });
userSchema.index({ schoolId: 1, classLevel: 1, role: 1 });

export type UserDocument = InferSchemaType<typeof userSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const UserModel = mongoose.model('User', userSchema);
