import mongoose, { Schema, InferSchemaType } from 'mongoose';

/**
 * School-scoped or platform-wide study material: notes, exam sheets,
 * worksheets and syllabi uploaded by teachers and admins.
 */
const studyMaterialSchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, required: true, index: true },
    createdByName: { type: String, default: '' },
    createdByRole: { type: String, default: 'teacher' },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    description: { type: String, default: '' },
    type: {
      type: String,
      enum: ['note', 'exam_sheet', 'syllabus', 'worksheet', 'other'],
      default: 'note',
      index: true,
    },
    classLevel: { type: Number, required: true, min: 1, max: 10, index: true },
    subject: { type: String, required: true, trim: true, index: true },
    chapter: { type: String, default: '' },
    fileId: { type: Schema.Types.Mixed, default: null },
    fileName: { type: String, default: '' },
    fileType: { type: String, default: '' },
    fileSize: { type: Number, default: 0 },
    externalUrl: { type: String, default: '' },
    textContent: { type: String, default: '' },
    visibility: { type: String, enum: ['school', 'class', 'global'], default: 'school', index: true },
    isPublished: { type: Boolean, default: true, index: true },
    downloadCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'study_materials' }
);

studyMaterialSchema.index({ schoolId: 1, classLevel: 1, subject: 1, createdAt: -1 });

export type StudyMaterialDocument = InferSchemaType<typeof studyMaterialSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const StudyMaterialModel = mongoose.model('StudyMaterial', studyMaterialSchema);
