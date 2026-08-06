import { Types } from 'mongoose';
import { usageRepository } from '../repositories/usage.repository';
import { settingsService } from './settings.service';
import { QUOTA_EXCEEDED_MESSAGE } from '../constants';

/**
 * Thrown when a user's token quota is exhausted.
 * The exact message is specified by the product requirements.
 */
export class QuotaExceededError extends Error {
  statusCode = 429;

  constructor() {
    super(QUOTA_EXCEEDED_MESSAGE);
    this.name = 'QuotaExceededError';
  }
}

export interface QuotaStatus {
  daily: { used: number; limit: number; remaining: number };
  monthly: { used: number; limit: number; remaining: number };
  exhausted: boolean;
}

function startOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfMonth(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(1);
  return d;
}

/**
 * Token quota service - enforces per-user daily/monthly AI token limits.
 * Limits of 0 mean "unlimited".
 */
export const quotaService = {
  async getStatus(userId: string | Types.ObjectId | null | undefined): Promise<QuotaStatus> {
    const aiSettings = await settingsService.getAISettings();

    if (!userId) {
      return {
        daily: { used: 0, limit: aiSettings.dailyQuotaPerUser, remaining: aiSettings.dailyQuotaPerUser },
        monthly: { used: 0, limit: aiSettings.monthlyQuotaPerUser, remaining: aiSettings.monthlyQuotaPerUser },
        exhausted: false,
      };
    }

    const [daily, monthly] = await Promise.all([
      usageRepository.summaryForUser(userId, { start: startOfDay(), end: new Date() }),
      usageRepository.summaryForUser(userId, { start: startOfMonth(), end: new Date() }),
    ]);

    const dailyLimit = aiSettings.dailyQuotaPerUser;
    const monthlyLimit = aiSettings.monthlyQuotaPerUser;

    const dailyRemaining = dailyLimit > 0 ? Math.max(0, dailyLimit - daily.totalTokens) : Number.MAX_SAFE_INTEGER;
    const monthlyRemaining = monthlyLimit > 0 ? Math.max(0, monthlyLimit - monthly.totalTokens) : Number.MAX_SAFE_INTEGER;

    const exhausted =
      (dailyLimit > 0 && daily.totalTokens >= dailyLimit) ||
      (monthlyLimit > 0 && monthly.totalTokens >= monthlyLimit);

    return {
      daily: {
        used: daily.totalTokens,
        limit: dailyLimit,
        remaining: dailyLimit > 0 ? dailyRemaining : -1,
      },
      monthly: {
        used: monthly.totalTokens,
        limit: monthlyLimit,
        remaining: monthlyLimit > 0 ? monthlyRemaining : -1,
      },
      exhausted,
    };
  },

  /**
   * Checks whether a request for `estimatedPromptTokens` can proceed.
   * Throws QuotaExceededError when the quota is exhausted.
   */
  async assertCanUseAI(
    userId: string | Types.ObjectId | null | undefined,
    estimatedPromptTokens: number
  ): Promise<void> {
    const status = await this.getStatus(userId);
    if (status.exhausted) {
      throw new QuotaExceededError();
    }

    const aiSettings = await settingsService.getAISettings();
    if (aiSettings.dailyQuotaPerUser > 0 && status.daily.limit > 0) {
      if (status.daily.used + estimatedPromptTokens > status.daily.limit) {
        throw new QuotaExceededError();
      }
    }
    if (aiSettings.monthlyQuotaPerUser > 0 && status.monthly.limit > 0) {
      if (status.monthly.used + estimatedPromptTokens > status.monthly.limit) {
        throw new QuotaExceededError();
      }
    }
  },

  async recordUsage(data: {
    userId?: Types.ObjectId | null;
    conversationId?: Types.ObjectId | null;
    messageId?: Types.ObjectId | null;
    model: string;
    promptTokens: number;
    completionTokens: number;
    requestType: 'chat' | 'summary' | 'ocr' | 'legacy';
  }): Promise<void> {
    const totalTokens = data.promptTokens + data.completionTokens;
    await usageRepository.record({
      userId: data.userId ?? null,
      conversationId: data.conversationId ?? null,
      messageId: data.messageId ?? null,
      model: data.model,
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
      totalTokens,
      requestType: data.requestType,
    });
  },
};

export default quotaService;
