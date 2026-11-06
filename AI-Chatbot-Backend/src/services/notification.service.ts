import { EventEmitter } from 'events';
import { Types } from 'mongoose';
import { NotificationModel } from '../database/models/Notification.model';
import { UserModel } from '../database/models/User.model';
import { AdminModel } from '../database/models/Admin.model';
import { log } from '../config/logger';

/** In-process pub/sub used by the SSE endpoint for instant delivery. */
export const notificationBus = new EventEmitter();
notificationBus.setMaxListeners(0);

export interface NotifyPayload {
  type:
    | 'school'
    | 'user'
    | 'question'
    | 'question_set'
    | 'assessment'
    | 'submission'
    | 'material'
    | 'book'
    | 'system';
  title: string;
  message?: string;
  link?: string;
  schoolId?: string | null;
  meta?: Record<string, unknown> | null;
}

export interface NotificationView {
  _id: string;
  type: string;
  title: string;
  message: string;
  link: string;
  schoolId: string | null;
  meta: Record<string, unknown> | null;
  readAt: string | null;
  createdAt: string;
}

function toView(doc: Record<string, unknown>): NotificationView {
  return {
    _id: String(doc._id),
    type: String(doc.type || 'system'),
    title: String(doc.title || ''),
    message: String(doc.message || ''),
    link: String(doc.link || ''),
    schoolId: doc.schoolId ? String(doc.schoolId) : null,
    meta: (doc.meta as Record<string, unknown> | null) ?? null,
    readAt: doc.readAt ? new Date(doc.readAt as string | Date).toISOString() : null,
    createdAt: new Date(doc.createdAt as string | Date).toISOString(),
  };
}

function uniqueIds(ids: Array<string | Types.ObjectId | null | undefined>, exclude?: string | null): string[] {
  const set = new Set<string>();
  for (const id of ids) {
    if (!id) continue;
    const value = String(id);
    if (exclude && value === exclude) continue;
    set.add(value);
  }
  return [...set];
}

/**
 * Persists notifications and pushes them to any live SSE subscribers.
 * Notifications are the durable source of truth; SSE is best-effort
 * (important on serverless platforms where connections are short lived).
 */
export const notificationService = {
  async notifyUsers(
    recipientIds: Array<string | Types.ObjectId | null | undefined>,
    payload: NotifyPayload,
    options: { actorId?: string | null; recipientRole?: string } = {}
  ): Promise<NotificationView[]> {
    const ids = uniqueIds(recipientIds, options.actorId);
    if (!ids.length) return [];

    try {
      const docs = await NotificationModel.insertMany(
        ids.map((recipientId) => ({
          recipientId: new Types.ObjectId(recipientId),
          recipientRole: options.recipientRole || '',
          schoolId: payload.schoolId ? new Types.ObjectId(payload.schoolId) : null,
          type: payload.type,
          title: payload.title,
          message: payload.message || '',
          link: payload.link || '',
          meta: payload.meta ?? null,
        }))
      );

      const views = docs.map((doc) => toView(doc.toObject() as Record<string, unknown>));
      views.forEach((view, index) => {
        notificationBus.emit(`user:${ids[index]}`, view);
      });
      return views;
    } catch (error) {
      log.warn('Notification delivery failed', { message: (error as Error).message });
      return [];
    }
  },

  /** Notifies every active user with one of the given roles in a school. */
  async notifySchoolRoles(
    schoolId: string | null | undefined,
    roles: string[],
    payload: NotifyPayload,
    options: { actorId?: string | null } = {}
  ): Promise<NotificationView[]> {
    if (!schoolId) return [];
    const users = await UserModel.find({
      schoolId,
      role: { $in: roles },
      isActive: true,
    })
      .select('_id role')
      .limit(1000)
      .lean();
    return this.notifyUsers(
      users.map((user) => String(user._id)),
      { ...payload, schoolId },
      { actorId: options.actorId }
    );
  },

  /** Notifies all students of a class (optionally within a school). */
  async notifyClassStudents(
    schoolId: string | null | undefined,
    classLevel: number,
    payload: NotifyPayload,
    options: { actorId?: string | null } = {}
  ): Promise<NotificationView[]> {
    const query: Record<string, unknown> = {
      role: { $in: ['student', 'user'] },
      classLevel,
      isActive: true,
    };
    if (schoolId) query.schoolId = schoolId;
    const users = await UserModel.find(query).select('_id').limit(2000).lean();
    return this.notifyUsers(
      users.map((user) => String(user._id)),
      { ...payload, schoolId: schoolId ?? null },
      { actorId: options.actorId }
    );
  },

  /** Notifies platform administrators. */
  async notifyPlatformAdmins(
    payload: NotifyPayload,
    options: { actorId?: string | null } = {}
  ): Promise<NotificationView[]> {
    const admins = await AdminModel.find({ isActive: true }).select('_id').limit(50).lean();
    return this.notifyUsers(
      admins.map((admin) => String(admin._id)),
      { ...payload, schoolId: payload.schoolId ?? null },
      { actorId: options.actorId, recipientRole: 'admin' }
    );
  },

  /** Notifies every active teacher and school admin across the platform. */
  async notifyAllStaff(payload: NotifyPayload, options: { actorId?: string | null } = {}): Promise<NotificationView[]> {
    const users = await UserModel.find({
      role: { $in: ['teacher', 'school_admin'] },
      isActive: true,
    })
      .select('_id')
      .limit(2000)
      .lean();
    return this.notifyUsers(users.map((user) => String(user._id)), payload, { actorId: options.actorId });
  },

  async list(recipientId: string, options: { unreadOnly?: boolean; limit?: number } = {}) {
    const query: Record<string, unknown> = { recipientId: new Types.ObjectId(recipientId) };
    if (options.unreadOnly) query.readAt = null;
    const limit = Math.min(Math.max(options.limit ?? 30, 1), 100);
    const [notifications, unread] = await Promise.all([
      NotificationModel.find(query).sort({ createdAt: -1 }).limit(limit).lean(),
      NotificationModel.countDocuments({ recipientId: new Types.ObjectId(recipientId), readAt: null }),
    ]);
    return {
      notifications: notifications.map((doc) => toView(doc as unknown as Record<string, unknown>)),
      unread,
    };
  },

  async markRead(recipientId: string, notificationId: string): Promise<boolean> {
    const result = await NotificationModel.updateOne(
      { _id: notificationId, recipientId: new Types.ObjectId(recipientId) },
      { $set: { readAt: new Date() } }
    );
    return result.modifiedCount > 0;
  },

  async markAllRead(recipientId: string): Promise<number> {
    const result = await NotificationModel.updateMany(
      { recipientId: new Types.ObjectId(recipientId), readAt: null },
      { $set: { readAt: new Date() } }
    );
    return result.modifiedCount;
  },
};

export default notificationService;
