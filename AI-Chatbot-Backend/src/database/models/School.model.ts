import mongoose, { Schema, InferSchemaType } from 'mongoose';

/**
 * A school, coaching centre, or academy using the platform.
 * Created and governed by the Super Admin. Each school has a unique join
 * code that students can use at registration and a dedicated School Admin.
 */
const schoolSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 160, index: true },
    type: { type: String, enum: ['school', 'coaching', 'individual'], default: 'school', index: true },
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, index: true },
    email: { type: String, lowercase: true, trim: true, default: '' },
    phone: { type: String, default: '' },
    address: { type: String, default: '' },
    district: { type: String, default: '' },
    logoUrl: { type: String, default: null },
    website: { type: String, default: '' },
    classLevels: { type: [Number], default: [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] },
    plan: { type: String, enum: ['free', 'basic', 'standard', 'enterprise'], default: 'free' },
    planExpiresAt: { type: Date, default: null },
    maxTeachers: { type: Number, default: 50 },
    maxStudents: { type: Number, default: 1000 },
    isActive: { type: Boolean, default: true, index: true },
    notes: { type: String, default: '' },
    createdBy: { type: String, default: 'superadmin' },
    stats: {
      teachers: { type: Number, default: 0 },
      students: { type: Number, default: 0 },
      questions: { type: Number, default: 0 },
      assessments: { type: Number, default: 0 },
    },
  },
  { timestamps: true, collection: 'schools' }
);

schoolSchema.index({ createdAt: -1 });

export type SchoolDocument = InferSchemaType<typeof schoolSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const SchoolModel = mongoose.model('School', schoolSchema);
