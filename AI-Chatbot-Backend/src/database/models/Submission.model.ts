import mongoose, { Schema, InferSchemaType } from 'mongoose';

const answerSchema = new Schema(
  {
    question: { type: Schema.Types.ObjectId, ref: 'Question', required: true },
    answer: { type: Schema.Types.Mixed, default: null },
    awardedMarks: { type: Number, default: 0 },
    feedback: { type: String, default: '' },
    isCorrect: { type: Boolean, default: null },
  },
  { _id: false }
);

/**
 * A student's answer sheet for one assessment.
 * Auto-gradable types (MCQ, true/false, one-word, matching, symbols, blanks)
 * are scored immediately; written answers wait for teacher grading.
 */
const submissionSchema = new Schema(
  {
    assessmentId: { type: Schema.Types.ObjectId, ref: 'Assessment', required: true, index: true },
    studentId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    schoolId: { type: Schema.Types.ObjectId, ref: 'School', default: null, index: true },
    classLevel: { type: Number, default: null },
    answers: { type: [answerSchema], default: [] },
    status: { type: String, enum: ['in_progress', 'submitted', 'graded'], default: 'submitted', index: true },
    autoScore: { type: Number, default: 0 },
    manualScore: { type: Number, default: 0 },
    totalScore: { type: Number, default: 0 },
    totalMarks: { type: Number, default: 0 },
    percentage: { type: Number, default: 0 },
    needsGrading: { type: Boolean, default: false, index: true },
    startedAt: { type: Date, default: null },
    submittedAt: { type: Date, default: Date.now },
    gradedAt: { type: Date, default: null },
    gradedBy: { type: Schema.Types.ObjectId, default: null },
    feedback: { type: String, default: '' },
    answerSheetUrl: { type: String, default: null },
  },
  { timestamps: true, collection: 'submissions' }
);

submissionSchema.index({ assessmentId: 1, studentId: 1 }, { unique: true });
submissionSchema.index({ studentId: 1, createdAt: -1 });
submissionSchema.index({ schoolId: 1, status: 1, createdAt: -1 });

export type SubmissionDocument = InferSchemaType<typeof submissionSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const SubmissionModel = mongoose.model('Submission', submissionSchema);
