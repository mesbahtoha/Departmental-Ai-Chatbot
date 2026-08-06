import mongoose, { Schema, InferSchemaType } from 'mongoose';

/**
 * Per-request AI token usage record (the analytics backbone).
 */
const aiUsageSchema = new Schema(
  {
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    conversationId: { type: Schema.Types.ObjectId, ref: 'Conversation', index: true },
    messageId: { type: Schema.Types.ObjectId, ref: 'Message', index: true },
    model: { type: String, default: '' },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    costUsd: { type: Number, default: 0 },
    requestType: {
      type: String,
      enum: ['chat', 'summary', 'ocr', 'legacy'],
      default: 'chat',
    },
  },
  { timestamps: true, collection: 'aiusage' }
);

aiUsageSchema.index({ userId: 1, createdAt: -1 });
aiUsageSchema.index({ createdAt: 1 });
aiUsageSchema.index({ userId: 1, createdAt: 1 });

export type AIUsageDocument = InferSchemaType<typeof aiUsageSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const AIUsageModel = mongoose.model('AIUsage', aiUsageSchema);
