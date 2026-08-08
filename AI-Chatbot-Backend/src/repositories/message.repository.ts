import { Types } from 'mongoose';
import { MessageModel, MessageDocument } from '../database/models/Message.model';

export interface CreateMessageData {
  conversationId: Types.ObjectId;
  userId?: Types.ObjectId;
  role: 'user' | 'assistant' | 'system';
  content: string;
  status?: 'pending' | 'streaming' | 'complete' | 'stopped' | 'error';
  model?: string | null;
  sources?: unknown[];
  citations?: unknown[];
  confidence?: 'high' | 'medium' | 'low';
  attachments?: unknown[];
}

/**
 * Message repository - typed data access for chat messages.
 */
export const messageRepository = {
  async findById(id: string | Types.ObjectId): Promise<MessageDocument | null> {
    return MessageModel.findById(id);
  },

  async findOwned(
    id: string | Types.ObjectId,
    userId: string | Types.ObjectId,
    conversationId?: string | Types.ObjectId
  ): Promise<MessageDocument | null> {
    const filter: Record<string, unknown> = { _id: id, userId };
    if (conversationId) filter.conversationId = conversationId;
    return MessageModel.findOne(filter as never);
  },

  async create(data: CreateMessageData): Promise<MessageDocument> {
    return MessageModel.create({
      conversationId: data.conversationId,
      userId: data.userId,
      role: data.role,
      content: data.content,
      status: data.status || 'complete',
      model: data.model ?? null,
      sources: data.sources || [],
      citations: data.citations || [],
      confidence: data.confidence || 'medium',
      attachments: data.attachments || [],
    });
  },

  async update(
    id: string | Types.ObjectId,
    data: Partial<
      Pick<MessageDocument, 'content' | 'status' | 'model' | 'promptTokens' | 'completionTokens' | 'totalTokens' | 'feedback' | 'feedbackComment' | 'errorMessage' | 'sources' | 'citations' | 'confidence' | 'attachments'>
    >
  ): Promise<MessageDocument | null> {
    return MessageModel.findByIdAndUpdate(id, { $set: data }, { new: true });
  },

  async listByConversation(
    conversationId: string | Types.ObjectId,
    options: { before?: Date; limit?: number; sort?: 'asc' | 'desc' } = {}
  ): Promise<MessageDocument[]> {
    const filter: Record<string, unknown> = { conversationId };
    if (options.before) filter.createdAt = { $lt: options.before };
    const sortDir = options.sort === 'desc' ? -1 : 1;
    return MessageModel.find(filter as never)
      .sort({ createdAt: sortDir })
      .limit(options.limit || 200);
  },

  async latestAssistant(
    conversationId: string | Types.ObjectId
  ): Promise<MessageDocument | null> {
    return MessageModel.findOne({ conversationId, role: 'assistant' })
      .sort({ createdAt: -1 })
      .limit(1) as Promise<MessageDocument | null>;
  },

  async deleteByConversation(conversationId: string | Types.ObjectId): Promise<void> {
    await MessageModel.deleteMany({ conversationId });
  },

  async deleteManyByUser(userId: string | Types.ObjectId): Promise<number> {
    const result = await MessageModel.deleteMany({ userId });
    return result.deletedCount ?? 0;
  },

  async deleteAfter(
    conversationId: string | Types.ObjectId,
    createdAt: Date
  ): Promise<void> {
    await MessageModel.deleteMany({ conversationId, createdAt: { $gte: createdAt } });
  },

  async count(filter: Record<string, unknown> = {}): Promise<number> {
    return MessageModel.countDocuments(filter as never);
  },
};
