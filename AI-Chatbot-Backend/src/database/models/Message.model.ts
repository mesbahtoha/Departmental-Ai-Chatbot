import mongoose, { Schema, InferSchemaType } from 'mongoose';

/**
 * A single chat message inside a conversation.
 */
const messageSchema = new Schema(
  {
    conversationId: {
      type: Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
      index: true,
    },
    userId: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    role: { type: String, enum: ['user', 'assistant', 'system'], required: true },
    content: { type: String, default: '' },
    model: { type: String, default: null },
    promptTokens: { type: Number, default: 0 },
    completionTokens: { type: Number, default: 0 },
    totalTokens: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['pending', 'streaming', 'complete', 'stopped', 'error'],
      default: 'complete',
    },
    sources: { type: [mongoose.Schema.Types.Mixed], default: [] },
    citations: { type: [mongoose.Schema.Types.Mixed], default: [] },
    confidence: { type: String, enum: ['high', 'medium', 'low'], default: 'medium' },
    feedback: { type: String, enum: ['like', 'dislike', null], default: null },
    feedbackComment: { type: String, default: '' },
    errorMessage: { type: String, default: null },
    /**
     * Metadata only for attachments attached to a user message
     * ({ id, name, type, mimeType, size }). The actual file bytes are never
     * persisted - they live in temporary memory and are deleted after the
     * AI response is generated.
     */
    attachments: { type: [mongoose.Schema.Types.Mixed], default: [] },
  },
  { timestamps: true, collection: 'messages' }
);

messageSchema.index({ conversationId: 1, createdAt: 1 });
messageSchema.index({ userId: 1, createdAt: -1 });

export type MessageDocument = InferSchemaType<typeof messageSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const MessageModel = mongoose.model('Message', messageSchema);
