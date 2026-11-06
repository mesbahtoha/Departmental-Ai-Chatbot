import mongoose, { Schema, InferSchemaType } from 'mongoose';

const setItemSchema = new Schema(
  {
    question: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    marks: { type: Number, default: null },
  },
  { _id: false }
);

/**
 * A reusable, ordered collection of questions for one class and subject.
 * Teachers, School Admins and Super Admins can build sets and reuse them
 * across quizzes, assignments and exams.
 */
const questionSetSchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, required: true, index: true },
    createdByRole: { type: String, default: 'teacher' },
    name: { type: String, required: true, trim: true, maxlength: 180 },
    description: { type: String, default: '' },
    classLevel: { type: Number, required: true, min: 1, max: 10, index: true },
    subject: { type: String, required: true, trim: true, index: true },
    items: { type: [setItemSchema], default: [] },
    totalMarks: { type: Number, default: 0 },
    questionCount: { type: Number, default: 0 },
    visibility: { type: String, enum: ['school', 'private', 'global'], default: 'school', index: true },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'published' },
  },
  { timestamps: true, collection: 'question_sets' }
);

questionSetSchema.index({ schoolId: 1, classLevel: 1, subject: 1 });
questionSetSchema.index({ createdBy: 1, createdAt: -1 });

export type QuestionSetDocument = InferSchemaType<typeof questionSetSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const QuestionSetModel = mongoose.model('QuestionSet', questionSetSchema);
