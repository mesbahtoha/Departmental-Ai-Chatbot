import { Types } from 'mongoose';
import { AIUsageModel } from '../database/models/AIUsage.model';

export interface UsageSummary {
  totalTokens: number;
  promptTokens: number;
  completionTokens: number;
  requests: number;
  costUsd: number;
}

export interface UsageRange {
  start: Date;
  end: Date;
}

/**
 * Token usage repository - powers quota checks, user indicators
 * and admin analytics.
 */
export const usageRepository = {
  async record(data: {
    userId?: Types.ObjectId | null;
    conversationId?: Types.ObjectId | null;
    messageId?: Types.ObjectId | null;
    model: string;
    promptTokens: number;
    completionTokens: number;
    totalTokens: number;
    costUsd?: number;
    requestType: 'chat' | 'summary' | 'ocr' | 'legacy';
  }): Promise<void> {
    await AIUsageModel.create({
      userId: data.userId ?? null,
      conversationId: data.conversationId ?? null,
      messageId: data.messageId ?? null,
      model: data.model,
      promptTokens: data.promptTokens,
      completionTokens: data.completionTokens,
      totalTokens: data.totalTokens,
      costUsd: data.costUsd || 0,
      requestType: data.requestType,
    });
  },

  async summaryForUser(
    userId: string | Types.ObjectId,
    range: UsageRange
  ): Promise<UsageSummary> {
    const [row] = await AIUsageModel.aggregate([
      { $match: { userId: new Types.ObjectId(String(userId)), createdAt: { $gte: range.start, $lt: range.end } } },
      {
        $group: {
          _id: null,
          totalTokens: { $sum: '$totalTokens' },
          promptTokens: { $sum: '$promptTokens' },
          completionTokens: { $sum: '$completionTokens' },
          requests: { $sum: 1 },
          costUsd: { $sum: '$costUsd' },
        },
      },
    ]);

    return {
      totalTokens: row?.totalTokens || 0,
      promptTokens: row?.promptTokens || 0,
      completionTokens: row?.completionTokens || 0,
      requests: row?.requests || 0,
      costUsd: row?.costUsd || 0,
    };
  },

  async globalSummary(range: UsageRange): Promise<UsageSummary> {
    const [row] = await AIUsageModel.aggregate([
      { $match: { createdAt: { $gte: range.start, $lt: range.end } } },
      {
        $group: {
          _id: null,
          totalTokens: { $sum: '$totalTokens' },
          promptTokens: { $sum: '$promptTokens' },
          completionTokens: { $sum: '$completionTokens' },
          requests: { $sum: 1 },
          costUsd: { $sum: '$costUsd' },
        },
      },
    ]);

    return {
      totalTokens: row?.totalTokens || 0,
      promptTokens: row?.promptTokens || 0,
      completionTokens: row?.completionTokens || 0,
      requests: row?.requests || 0,
      costUsd: row?.costUsd || 0,
    };
  },

  async dailySeries(range: UsageRange, timezoneOffsetMinutes = 0): Promise<Array<{ date: string; totalTokens: number; requests: number }>> {
    return AIUsageModel.aggregate([
      {
        $match: {
          createdAt: { $gte: range.start, $lt: range.end },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: {
              format: '%Y-%m-%d',
              date: { $dateAdd: { startDate: '$createdAt', unit: 'minute', amount: timezoneOffsetMinutes } },
            },
          },
          totalTokens: { $sum: '$totalTokens' },
          requests: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          date: '$_id',
          totalTokens: 1,
          requests: 1,
        },
      },
    ]);
  },

  async topModels(range: UsageRange, limit = 5): Promise<Array<{ model: string; totalTokens: number; requests: number }>> {
    return AIUsageModel.aggregate([
      { $match: { createdAt: { $gte: range.start, $lt: range.end } } },
      {
        $group: {
          _id: '$model',
          totalTokens: { $sum: '$totalTokens' },
          requests: { $sum: 1 },
        },
      },
      { $sort: { totalTokens: -1 } },
      { $limit: limit },
      { $project: { _id: 0, model: '$_id', totalTokens: 1, requests: 1 } },
    ]);
  },

  async totalRequests(): Promise<number> {
    return AIUsageModel.countDocuments();
  },
};
