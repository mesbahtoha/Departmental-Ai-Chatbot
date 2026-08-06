import { ChatLogModel, ChunkModel, ConversationModel, MessageModel, NoticeModel, RefreshTokenModel, AIUsageModel } from '../database/models';

/**
 * Central index creation. Idempotent - safe to run on every boot.
 */
export async function ensureIndexes(): Promise<void> {
  const tasks: Promise<unknown>[] = [];

  // Conversations
  tasks.push(
    ConversationModel.collection.createIndex({ userId: 1, pinned: -1, updatedAt: -1 }),
    ConversationModel.collection.createIndex({ userId: 1, title: 'text' }),
    ConversationModel.collection.createIndex({ shareToken: 1 }, { sparse: true })
  );

  // Messages
  tasks.push(
    MessageModel.collection.createIndex({ conversationId: 1, createdAt: 1 }),
    MessageModel.collection.createIndex({ userId: 1, createdAt: -1 })
  );

  // Usage
  tasks.push(
    AIUsageModel.collection.createIndex({ userId: 1, createdAt: -1 }),
    AIUsageModel.collection.createIndex({ createdAt: 1 }),
    AIUsageModel.collection.createIndex({ userId: 1, createdAt: 1 })
  );

  // Refresh tokens
  tasks.push(
    RefreshTokenModel.collection.createIndex({ expiresAt: 1 }, { expireAfterSeconds: 0 }),
    RefreshTokenModel.collection.createIndex({ userId: 1 })
  );

  // Legacy notices + chunks (text indexes preserved)
  tasks.push(
    NoticeModel.collection.createIndex({ title: 'text', normalizedText: 'text', category: 'text', summary: 'text' }),
    NoticeModel.collection.createIndex({ createdAt: -1 }),
    NoticeModel.collection.createIndex({ category: 1, createdAt: -1 }),
    ChunkModel.collection.createIndex({ documentId: 1 }),
    ChunkModel.collection.createIndex({ category: 1 }),
    ChunkModel.collection.createIndex({ title: 'text', chunkText: 'text' })
  );

  // Legacy chat logs
  tasks.push(
    ChatLogModel.collection.createIndex({ userId: 1, createdAt: -1 })
  );

  await Promise.allSettled(tasks);
}
