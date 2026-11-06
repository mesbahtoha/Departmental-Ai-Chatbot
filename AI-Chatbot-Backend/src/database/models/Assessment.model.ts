import mongoose, { Schema, InferSchemaType } from 'mongoose';

const assessmentItemSchema = new Schema(
  {
    question: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    marks: { type: Number, default: 1 },
  },
  { _id: false }
);

/**
 * A quiz, assignment or exam created by a Teacher / School Admin /
 * Super Admin and assigned to one class (optionally to specific students).
 */
const assessmentSchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, required: true, index: true },
    createdByRole: { type: String, default: 'teacher' },
    createdByName: { type: String, default: '' },
    type: { type: String, enum: ['quiz', 'assignment', 'exam'], default: 'quiz', index: true },
    title: { type: String, required: true, trim: true, maxlength: 200 },
    instructions: { type: String, default: '' },
    classLevel: { type: Number, required: true, min: 1, max: 10, index: true },
    subject: { type: String, required: true, trim: true, index: true },
    items: { type: [assessmentItemSchema], default: [] },
    questionCount: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    assignedStudentIds: { type: [Schema.Types.ObjectId], ref: 'User', default: [] },
    startAt: { type: Date, default: null },
    dueAt: { type: Date, default: null },
    durationMinutes: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 1 },
    shuffleQuestions: { type: Boolean, default: false },
    allowLateSubmission: { type: Boolean, default: false },
    showResults: { type: Boolean, default: true },
    status: { type: String, enum: ['draft', 'published', 'closed'], default: 'draft', index: true },
    publishedAt: { type: Date, default: null },
    submissionCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'assessments' }
);

assessmentSchema.index({ schoolId: 1, classLevel: 1, status: 1, createdAt: -1 });
assessmentSchema.index({ createdBy: 1, createdAt: -1 });

export type AssessmentDocument = InferSchemaType<typeof assessmentSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const AssessmentModel = mongoose.model('Assessment', assessmentSchema);
