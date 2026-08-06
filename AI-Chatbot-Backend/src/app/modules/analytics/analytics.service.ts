import { usageRepository } from '../../../repositories/usage.repository';
import type { UsageRange } from '../../../repositories/usage.repository';

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

function startOfDay(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}

export type AnalyticsRange = UsageRange;

/**
 * Analytics service - token usage analytics shared by the
 * admin panel and the user-facing usage indicators.
 */
export const analyticsService = {
  range(from?: string, to?: string): AnalyticsRange {
    return {
      start: from ? new Date(from) : daysAgo(30),
      end: to ? new Date(to) : new Date(),
    };
  },

  async usageSeries(range: AnalyticsRange): Promise<Array<{ date: string; totalTokens: number; requests: number }>> {
    return usageRepository.dailySeries(range);
  },

  async usageSummary(range: AnalyticsRange) {
    return usageRepository.globalSummary(range);
  },

  async topModels(range: AnalyticsRange, limit = 5) {
    return usageRepository.topModels(range, limit);
  },

  async todaySeries() {
    return usageRepository.dailySeries({ start: startOfDay(), end: new Date() });
  },

  async totalRequests(): Promise<number> {
    return usageRepository.totalRequests();
  },
};

export default analyticsService;
