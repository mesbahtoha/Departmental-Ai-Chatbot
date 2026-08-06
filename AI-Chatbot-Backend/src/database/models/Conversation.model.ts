import mongoose, { Schema, InferSchemaType } from 'mongoose';

/**
 * A conversation (chat thread) owned by a user.
 */
const conversationSchema = new Schema(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      index: true,
    },
    title: { type: String, trim: true, maxlength: 120, default: 'New chat' },
    pinned: { type: Boolean, default: false },
    isArchived: { type: Boolean, default: false },
    lastMessageAt: { type: Date, default: null },
    messageCount: { type: Number, default: 0 },
    shareToken: { type: String, default: null },
  },
  { timestamps: true, collection: 'conversations' }
);

conversationSchema.index({ userId: 1, pinned: -1, updatedAt: -1 });
conversationSchema.index({ userId: 1, title: 'text' });
conversationSchema.index({ shareToken: 1 }, { sparse: true });

export type ConversationDocument = InferSchemaType<typeof conversationSchema> & {
  _id: mongoose.Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
};

export const ConversationModel = mongoose.model('Conversation', conversationSchema);
