import { Types } from 'mongoose';
import { ConversationModel, ConversationDocument } from '../database/models/Conversation.model';

export interface ConversationListOptions {
  search?: string;
  page?: number;
  limit?: number;
}

/**
 * Conversation repository - typed data access for chat threads.
 */
export const conversationRepository = {
  async findById(id: string | Types.ObjectId): Promise<ConversationDocument | null> {
    return ConversationModel.findById(id);
  },

  async findOwned(id: string | Types.ObjectId, userId: string | Types.ObjectId): Promise<ConversationDocument | null> {
    return ConversationModel.findOne({ _id: id, userId });
  },

  async create(data: {
    userId: Types.ObjectId;
    title?: string;
  }): Promise<ConversationDocument> {
    return ConversationModel.create({
      userId: data.userId,
      title: data.title || 'New chat',
    });
  },

  async listByUser(
    userId: string | Types.ObjectId,
    options: ConversationListOptions = {}
  ): Promise<{ items: ConversationDocument[]; total: number }> {
    const page = options.page || 1;
    const limit = Math.min(options.limit || 30, 100);
    const filter: Record<string, unknown> = {
      userId,
      isArchived: false,
    };

    if (options.search) {
      filter.$or = [
        { title: { $regex: options.search, $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      ConversationModel.find(filter as never)
        .sort({ pinned: -1, updatedAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      ConversationModel.countDocuments(filter as never),
    ]);

    return { items, total };
  },

  async update(
    id: string | Types.ObjectId,
    data: Partial<Pick<ConversationDocument, 'title' | 'pinned' | 'isArchived' | 'lastMessageAt' | 'messageCount' | 'shareToken'>>
  ): Promise<ConversationDocument | null> {
    return ConversationModel.findByIdAndUpdate(id, { $set: data }, { new: true });
  },

  async delete(id: string | Types.ObjectId): Promise<void> {
    await ConversationModel.deleteOne({ _id: id });
  },

  async deleteManyByUser(userId: string | Types.ObjectId): Promise<number> {
    const result = await ConversationModel.deleteMany({ userId });
    return result.deletedCount ?? 0;
  },

  async touchLastMessage(id: string | Types.ObjectId, increment = 1): Promise<void> {
    await ConversationModel.updateOne(
      { _id: id },
      { $set: { lastMessageAt: new Date() }, $inc: { messageCount: increment } }
    );
  },

  async setShareToken(id: string | Types.ObjectId, token: string | null): Promise<void> {
    await ConversationModel.updateOne({ _id: id }, { $set: { shareToken: token } });
  },

  async findByShareToken(token: string): Promise<ConversationDocument | null> {
    return ConversationModel.findOne({ shareToken: token });
  },

  async count(filter: Record<string, unknown> = {}): Promise<number> {
    return ConversationModel.countDocuments(filter as never);
  },
};
