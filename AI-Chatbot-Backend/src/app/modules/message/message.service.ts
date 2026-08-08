import { Types } from 'mongoose';
import { messageRepository } from '../../../repositories/message.repository';
import { conversationRepository } from '../../../repositories/conversation.repository';
import { aiService } from '../../../services/ai.service';
import { estimateTokens } from '../../../utils/text.utils';
import { MessageDocument } from '../../../database/models/Message.model';
import { ChatMessageInput } from '../../../services/openrouter.client';
import { log } from '../../../config/logger';

const HISTORY_LIMIT = 12;

export interface PreparedStream {
  userContent: string;
  userMessage: MessageDocument | null;
  assistantMessage: MessageDocument;
  openRouterMessages: ChatMessageInput[];
  estimatedPromptTokens: number;
  context?: {
    searchResults: unknown[];
    citations: Array<Record<string, unknown>>;
  };
}

interface MessageLike {
  _id: Types.ObjectId;
  role: string;
  content: string;
  createdAt: Date;
}

/**
 * Message service - prepares AI streaming requests and persists messages.
 */
export const messageService = {
  /**
   * Persists a user message, sets the conversation title on first message,
   * and prepares the OpenRouter payload (history + RAG context).
   */
  async prepareNewMessage(input: {
    conversationId: string;
    userId: string;
    content: string;
    language?: string;
  }): Promise<PreparedStream> {
    const conversation = await conversationRepository.findOwned(
      input.conversationId,
      input.userId
    );

    if (!conversation) {
      const error = new Error('Conversation not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const userMessage = await messageRepository.create({
      conversationId: conversation._id,
      userId: new Types.ObjectId(input.userId),
      role: 'user',
      content: input.content,
    });

    await conversationRepository.touchLastMessage(conversation._id, 1);

    // Auto-title the conversation from the first user message.
    if (!conversation.title || conversation.title === 'New chat') {
      const title = input.content.replace(/\s+/g, ' ').trim().slice(0, 42);
      await conversationRepository.update(conversation._id, {
        title: title || 'New chat',
      });
    }

    const history = await this.getHistory(conversation._id, userMessage._id);

    const { messages, context } = await aiService.buildChatMessages({
      userContent: input.content,
      history,
      language: input.language,
    });

    const assistantMessage = await messageRepository.create({
      conversationId: conversation._id,
      userId: new Types.ObjectId(input.userId),
      role: 'assistant',
      content: '',
      status: 'pending',
    });

    return {
      userContent: input.content,
      userMessage,
      assistantMessage,
      openRouterMessages: messages,
      estimatedPromptTokens: estimateTokens(JSON.stringify(messages)),
      context,
    };
  },

  /**
   * Regenerates an assistant response: removes the old assistant message
   * (and anything after it) and re-asks with the same user message.
   */
  async prepareRegenerate(input: {
    conversationId: string;
    userId: string;
    messageId: string;
    language?: string;
  }): Promise<PreparedStream> {
    const conversation = await conversationRepository.findOwned(
      input.conversationId,
      input.userId
    );
    if (!conversation) {
      const error = new Error('Conversation not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const target = await messageRepository.findOwned(
      input.messageId,
      input.userId,
      conversation._id
    );
    if (!target || target.role !== 'assistant') {
      const error = new Error('Message not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const allMessages = (await messageRepository.listByConversation(conversation._id, {
      limit: 500,
    })) as unknown as MessageLike[];

    const targetIndex = allMessages.findIndex((m) => String(m._id) === String(target._id));
    if (targetIndex === -1) {
      const error = new Error('Message not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const userMessage = allMessages
      .slice(0, targetIndex)
      .reverse()
      .find((m) => m.role === 'user');

    if (!userMessage) {
      const error = new Error('Cannot regenerate: no user message found') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    // Remove the assistant message and everything after it.
    await messageRepository.deleteAfter(conversation._id, target.createdAt);

    const history = await this.getHistory(conversation._id, userMessage._id);

    const { messages, context } = await aiService.buildChatMessages({
      userContent: userMessage.content,
      history,
      language: input.language,
    });

    const assistantMessage = await messageRepository.create({
      conversationId: conversation._id,
      userId: new Types.ObjectId(input.userId),
      role: 'assistant',
      content: '',
      status: 'pending',
    });

    return {
      userContent: userMessage.content,
      userMessage: null,
      assistantMessage,
      openRouterMessages: messages,
      estimatedPromptTokens: estimateTokens(JSON.stringify(messages)),
      context,
    };
  },

  /** Continues generation from the last assistant message. */
  async prepareContinue(input: {
    conversationId: string;
    userId: string;
    language?: string;
  }): Promise<PreparedStream> {
    const conversation = await conversationRepository.findOwned(
      input.conversationId,
      input.userId
    );
    if (!conversation) {
      const error = new Error('Conversation not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const latestAssistant = await messageRepository.latestAssistant(conversation._id);
    if (!latestAssistant) {
      const error = new Error('Nothing to continue: no previous response found') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    const history = await this.getHistory(conversation._id);

    const { messages, context } = await aiService.buildChatMessages({
      userContent: 'Please continue generating your previous response exactly from where you left off.',
      history,
      language: input.language,
    });

    const assistantMessage = await messageRepository.create({
      conversationId: conversation._id,
      userId: new Types.ObjectId(input.userId),
      role: 'assistant',
      content: '',
      status: 'pending',
    });

    return {
      userContent: '(continue)',
      userMessage: null,
      assistantMessage,
      openRouterMessages: messages,
      estimatedPromptTokens: estimateTokens(JSON.stringify(messages)),
      context,
    };
  },

  async submitFeedback(input: {
    conversationId: string;
    userId: string;
    messageId: string;
    type: 'like' | 'dislike';
    comment?: string;
  }): Promise<boolean> {
    const message = await messageRepository.findOwned(
      input.messageId,
      input.userId,
      input.conversationId
    );
    if (!message || message.role !== 'assistant') return false;

    await messageRepository.update(message._id, {
      feedback: input.type,
      feedbackComment: input.comment || '',
    });
    return true;
  },

  async getHistory(
    conversationId: Types.ObjectId,
    beforeMessageId?: Types.ObjectId
  ): Promise<Array<{ role: 'user' | 'assistant'; content: string }>> {
    // Resolve the cut-off point, then fetch the *most recent* HISTORY_LIMIT
    // messages before it (previously the oldest messages were returned,
    // which starved long conversations of context).
    let before: Date | undefined;
    if (beforeMessageId) {
      const refMessage = await messageRepository.findById(beforeMessageId);
      if (refMessage) before = refMessage.createdAt;
    }

    const messages = (await messageRepository.listByConversation(conversationId, {
      before,
      limit: HISTORY_LIMIT,
      sort: 'desc',
    })) as unknown as MessageLike[];

    return messages
      .reverse()
      .filter((m) => m.role === 'user' || m.role === 'assistant')
      .map((m) => ({
        role: (m.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
        content: m.content,
      }));
  },

  async markStreaming(messageId: Types.ObjectId): Promise<void> {
    await messageRepository.update(messageId, { status: 'streaming' });
  },

  async finalizeMessage(
    messageId: Types.ObjectId,
    data: {
      content: string;
      status: 'streaming' | 'complete' | 'stopped' | 'error';
      model?: string;
      promptTokens?: number;
      completionTokens?: number;
      totalTokens?: number;
      errorMessage?: string | null;
      sources?: unknown[];
      citations?: unknown[];
    }
  ): Promise<void> {
    await messageRepository.update(messageId, {
      content: data.content,
      status: data.status,
      model: data.model ?? null,
      promptTokens: data.promptTokens ?? 0,
      completionTokens: data.completionTokens ?? 0,
      totalTokens: data.totalTokens ?? 0,
      errorMessage: data.errorMessage ?? null,
      sources: data.sources ?? [],
      citations: data.citations ?? [],
    });
    log.info('Message finalized', { messageId: String(messageId), status: data.status });
  },

  async getMessage(messageId: string, userId: string): Promise<MessageDocument | null> {
    return messageRepository.findOwned(messageId, userId);
  },
};

export default messageService;
