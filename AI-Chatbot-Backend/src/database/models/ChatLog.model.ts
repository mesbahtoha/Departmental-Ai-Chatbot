import mongoose, { Schema, InferSchemaType } from 'mongoose';

/**
 * Legacy chat log entries - preserved so the old API
 * (/api/student/query, /api/ai/ask) keeps its exact contract.
 */
const chatLogSchema = new Schema(
  {
    userId: { type: String, default: null, index: true },
    query: { type: String, default: '' },
    answer: { type: String, default: '' },
    sources: { type: [mongoose.Schema.Types.Mixed], default: [] },
    citations: { type: [mongoose.Schema.Types.Mixed], default: [] },
    confidence: { type: String, default: 'medium' },
    mode: { type: String, default: 'answer' },
  },
  { timestamps: true, collection: 'chatLogs' }
);

chatLogSchema.index({ userId: 1, createdAt: -1 });

export type ChatLogDocument = InferSchemaType<typeof chatLogSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const ChatLogModel = mongoose.model('ChatLog', chatLogSchema);

/**
 * Legacy feedback entries.
 */
const feedbackSchema = new Schema(
  {
    chatLogId: { type: Schema.Types.ObjectId, index: true },
    type: { type: String, default: '' },
    comment: { type: String, default: '' },
  },
  { timestamps: true, collection: 'feedback' }
);

export const FeedbackModel = mongoose.model('Feedback', feedbackSchema);
