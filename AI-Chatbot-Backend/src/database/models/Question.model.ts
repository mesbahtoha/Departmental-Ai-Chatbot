import mongoose, { Schema, InferSchemaType } from 'mongoose';
import { QUESTION_TYPE_KEYS } from '../../constants/academic';

/**
 * One question in the NCTB question bank.
 * `schoolId = null` means a global question authored by the platform.
 * Every question belongs to exactly one class (1-10).
 */
const optionSchema = new Schema(
  {
    key: { type: String, required: true, trim: true },
    text: { type: String, default: '' },
    imageUrl: { type: String, default: null },
  },
  { _id: false }
);

const pairSchema = new Schema(
  {
    left: { type: String, default: '' },
    right: { type: String, default: '' },
    imageUrl: { type: String, default: null },
  },
  { _id: false }
);

const blankSchema = new Schema(
  {
    index: { type: Number, default: 0 },
    answer: { type: String, default: '' },
    clue: { type: String, default: '' },
  },
  { _id: false }
);

const labelSchema = new Schema(
  {
    label: { type: String, default: '' },
    answer: { type: String, default: '' },
    x: { type: Number, default: null },
    y: { type: Number, default: null },
  },
  { _id: false }
);

const questionSchema = new Schema(
  {
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', default: null, index: true },
    createdBy: { type: Schema.Types.ObjectId, required: true, index: true },
    createdByRole: { type: String, default: 'teacher' },
    classLevel: { type: Number, required: true, min: 1, max: 10, index: true },
    subject: { type: String, required: true, trim: true, index: true },
    chapter: { type: String, default: '', index: true },
    topic: { type: String, default: '' },
    type: { type: String, enum: QUESTION_TYPE_KEYS, required: true, index: true },
    prompt: { type: String, required: true },
    passage: { type: String, default: '' },
    instructions: { type: String, default: '' },
    mediaUrl: { type: String, default: null },
    options: { type: [optionSchema], default: [] },
    correctAnswers: { type: [String], default: [] },
    pairs: { type: [pairSchema], default: [] },
    blanks: { type: [blankSchema], default: [] },
    labels: { type: [labelSchema], default: [] },
    tableData: { type: Schema.Types.Mixed, default: null },
    answerText: { type: String, default: '' },
    explanation: { type: String, default: '' },
    marks: { type: Number, default: 1, min: 0 },
    difficulty: { type: String, enum: ['easy', 'medium', 'hard'], default: 'medium', index: true },
    tags: { type: [String], default: [] },
    isPublic: { type: Boolean, default: false, index: true },
    status: { type: String, enum: ['draft', 'published', 'archived'], default: 'published', index: true },
    usageCount: { type: Number, default: 0 },
  },
  { timestamps: true, collection: 'questions' }
);

questionSchema.index({ schoolId: 1, classLevel: 1, subject: 1, type: 1 });
questionSchema.index({ classLevel: 1, subject: 1, status: 1 });
questionSchema.index({ prompt: 'text', tags: 'text' });

export type QuestionDocument = InferSchemaType<typeof questionSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const QuestionModel = mongoose.model('Question', questionSchema);
