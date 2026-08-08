import os from 'os';
import mongoose from 'mongoose';
import { userRepository } from '../../../repositories/user.repository';
import { conversationRepository } from '../../../repositories/conversation.repository';
import { messageRepository } from '../../../repositories/message.repository';
import { noticeRepository } from '../../../repositories/notice.repository';
import { usageRepository } from '../../../repositories/usage.repository';
import { adminRepository } from '../../../repositories/admin.repository';
import { UserModel, ChatLogModel, LogModel, MessageModel } from '../../../database/models';
import { settingsService } from '../../../services/settings.service';
import { analyticsService } from '../analytics/analytics.service';
import env from '../../../config/env';

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

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(0, 0, 0, 0);
  return d;
}

/**
 * Admin service - dashboard stats, user management, analytics,
 * logs and system monitoring.
 */
export const adminService = {
  async dashboard(): Promise<Record<string, unknown>> {
    const now = new Date();

    const [
      totalUsers,
      activeUsers,
      totalConversations,
      totalMessages,
      totalNotices,
      todayUsage,
      monthUsage,
      totalRequests,
    ] = await Promise.all([
      userRepository.count(),
      userRepository.count({ isActive: true }),
      conversationRepository.count(),
      messageRepository.count(),
      noticeRepository.count(),
      usageRepository.globalSummary({ start: startOfDay(), end: now }),
      usageRepository.globalSummary({ start: startOfMonth(), end: now }),
      usageRepository.totalRequests(),
    ]);

    const recentMessages = await messageRepository.count({
      createdAt: { $gte: daysAgo(7) },
    });

    return {
      users: { total: totalUsers, active: activeUsers },
      conversations: totalConversations,
      messages: totalMessages,
      messagesLast7Days: recentMessages,
      notices: totalNotices,
      usage: {
        today: todayUsage,
        month: monthUsage,
        totalRequests,
      },
      generatedAt: new Date(),
    };
  },

  async listUsers(search: string, page: number, limit: number) {
    const filter = search
      ? {
          $or: [
            { name: { $regex: search, $options: 'i' } },
            { email: { $regex: search, $options: 'i' } },
          ],
        }
      : {};

    const { items, total } = await userRepository.findPaginated(filter, page, limit);

    return {
      items: items.map((u) => ({
        id: u._id,
        name: u.name,
        email: u.email,
        role: u.role,
        avatarUrl: u.avatarUrl,
        isActive: u.isActive,
        lastLoginAt: u.lastLoginAt,
        createdAt: u.createdAt,
      })),
      total,
    };
  },

  async updateUser(
    userId: string,
    data: { name?: string; email?: string; isActive?: boolean; role?: 'user' | 'admin' }
  ) {
    const user = await UserModel.findById(userId);
    if (!user) return null;

    if (data.email && data.email.toLowerCase() !== user.email) {
      const existing = await userRepository.findByEmail(data.email);
      if (existing && String(existing._id) !== userId) {
        const error = new Error('An account with this email already exists') as Error & { statusCode?: number };
        error.statusCode = 409;
        throw error;
      }
    }

    const updated = await userRepository.update(userId, data);
    return updated;
  },

  async deleteUser(userId: string): Promise<boolean> {
    const user = await userRepository.findById(userId);
    if (!user) return false;

    // Cascade: bulk-delete all of the user's data, then the user record.
    await Promise.all([
      messageRepository.deleteManyByUser(userId),
      conversationRepository.deleteManyByUser(userId),
      ChatLogModel.deleteMany({ userId }),
    ]);
    await userRepository.delete(userId);
    return true;
  },

  async chatHistory(search: string, page: number, limit: number) {
    const match: Record<string, unknown> = {};

    if (search) {
      match.$or = [
        { 'conversation.title': { $regex: search, $options: 'i' } },
        { content: { $regex: search, $options: 'i' } },
      ];
    }

    const result = await MessageModel.aggregate([
      {
        $lookup: {
          from: 'conversations',
          localField: 'conversationId',
          foreignField: '_id',
          as: 'conversation',
        },
      },
      { $unwind: { path: '$conversation', preserveNullAndEmptyArrays: true } },
      { $match: match },
      { $sort: { createdAt: -1 } },
      { $skip: (page - 1) * limit },
      { $limit: limit },
      {
        $project: {
          id: '$_id',
          role: 1,
          content: 1,
          model: 1,
          status: 1,
          feedback: 1,
          totalTokens: 1,
          createdAt: 1,
          conversationId: '$conversation._id',
          conversationTitle: '$conversation.title',
          userId: '$conversation.userId',
        },
      },
    ]);

    const total = await MessageModel.aggregate([
      {
        $lookup: {
          from: 'conversations',
          localField: 'conversationId',
          foreignField: '_id',
          as: 'conversation',
        },
      },
      { $unwind: { path: '$conversation', preserveNullAndEmptyArrays: true } },
      { $match: match },
      { $count: 'total' },
    ]);

    return {
      items: result,
      total: total[0]?.total || 0,
    };
  },

  async usageAnalytics(from?: string, to?: string, groupBy: 'day' | 'month' = 'day') {
    const range = analyticsService.range(from, to);

    const series = await analyticsService.usageSeries(range);
    const summary = await analyticsService.usageSummary(range);
    const topModels = await analyticsService.topModels(range);
    const todaySeries = await analyticsService.todaySeries();

    return {
      range: { from: range.start, to: range.end },
      summary,
      series: groupBy === 'day' ? series : series,
      topModels,
      today: todaySeries.reduce((acc, row) => acc + row.totalTokens, 0),
    };
  },

  async getSettings() {
    return settingsService.getAllForAdmin();
  },

  async updateSettings(entries: Array<{ key: string; value: unknown }>) {
    await settingsService.updateMany(entries);
    return settingsService.getAllForAdmin();
  },

  async listLogs(level: string | undefined, page: number, limit: number) {
    const filter = level ? { level } : {};
    const [items, total] = await Promise.all([
      LogModel.find(filter as never)
        .sort({ timestamp: -1 })
        .skip((page - 1) * limit)
        .limit(limit),
      LogModel.countDocuments(filter as never),
    ]);

    return {
      items: items.map((logItem) => ({
        id: logItem._id,
        level: logItem.level,
        message: logItem.message,
        meta: logItem.meta,
        source: logItem.source,
        timestamp: logItem.timestamp,
      })),
      total,
    };
  },

  async systemInfo() {
    const dbStats = await mongoose.connection.db?.stats();
    const serverInfo = await mongoose.connection.db?.admin().serverInfo();

    const memory = process.memoryUsage();

    return {
      uptime: process.uptime(),
      nodeVersion: process.version,
      platform: `${os.platform()} ${os.arch()}`,
      cpus: os.cpus().length,
      loadAverage: os.loadavg(),
      totalMemoryMb: Math.round(os.totalmem() / 1024 / 1024),
      freeMemoryMb: Math.round(os.freemem() / 1024 / 1024),
      processMemory: {
        rssMb: Math.round(memory.rss / 1024 / 1024),
        heapTotalMb: Math.round(memory.heapTotal / 1024 / 1024),
        heapUsedMb: Math.round(memory.heapUsed / 1024 / 1024),
      },
      mongodb: {
        status: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
        version: serverInfo?.version || null,
        dbSizeMb: dbStats ? Math.round(dbStats.dataSize / 1024 / 1024) : 0,
        collections: dbStats?.collections || 0,
      },
      env: env.nodeEnv,
      appBaseUrl: env.appBaseUrl,
      model: env.openRouter.model,
    };
  },

  async tokenOverview() {
    const [today, month, totalUsage, topModels] = await Promise.all([
      usageRepository.globalSummary({ start: startOfDay(), end: new Date() }),
      usageRepository.globalSummary({ start: startOfMonth(), end: new Date() }),
      usageRepository.globalSummary({ start: new Date(0), end: new Date() }),
      usageRepository.topModels({ start: daysAgo(30), end: new Date() }, 10),
    ]);

    const adminCount = await adminRepository.count();
    const totalUsers = await userRepository.count();
    const averageDaily = totalUsage.requests
      ? Math.round(totalUsage.totalTokens / Math.max(1, totalUsage.requests))
      : 0;

    return {
      today,
      month,
      allTime: totalUsage,
      topModels,
      perRequestAverageTokens: averageDaily,
      apiKeyConfigured: Boolean(env.openRouter.apiKey),
      accounts: { users: totalUsers, admins: adminCount },
    };
  },
};

export default adminService;
