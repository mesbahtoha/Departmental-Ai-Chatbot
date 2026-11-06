import { Types } from 'mongoose';
import type { Request } from 'express';
import { isPlatformRole } from '../constants';

/** True when the caller owns the platform (full cross-tenant access). */
export function isPlatform(req: Request): boolean {
  return isPlatformRole(req.user?.role);
}

/** ObjectId for the caller's school, or null. */
export function schoolObjectId(req: Request): Types.ObjectId | null {
  const schoolId = req.user?.schoolId;
  if (!schoolId) return null;
  try {
    return new Types.ObjectId(schoolId);
  } catch {
    return null;
  }
}

/**
 * Filter for listing content the caller is allowed to see.
 * Platform admins see everything. School members see their school's content
 * plus global (schoolId: null) content created by the platform.
 */
export function visibleContentFilter(req: Request, extra: Record<string, unknown> = {}): Record<string, unknown> {
  if (isPlatform(req)) return { ...extra };
  const schoolId = schoolObjectId(req);
  if (!schoolId) return { ...extra, schoolId: null };
  return { ...extra, $or: [{ schoolId }, { schoolId: null }] };
}

/**
 * Filter for listing content the caller is allowed to manage.
 * Platform admins: everything. School admins: their school. Teachers: their
 * own school's content (the school shares a question bank).
 */
export function manageableContentFilter(req: Request, extra: Record<string, unknown> = {}): Record<string, unknown> {
  if (isPlatform(req)) return { ...extra };
  const schoolId = schoolObjectId(req);
  if (!schoolId) return { ...extra, schoolId: null, createdBy: req.user?.id };
  return { ...extra, schoolId };
}

/**
 * Checks whether the caller may edit/delete a specific document.
 * Teachers and school admins are limited to their own school; only platform
 * admins may edit global content.
 */
export function canManageDocument(
  req: Request,
  doc: { schoolId?: unknown; createdBy?: unknown } | null | undefined
): boolean {
  if (!doc) return false;
  if (isPlatform(req)) return true;
  const schoolId = req.user?.schoolId;
  if (!schoolId || !doc.schoolId) return false;
  return String(doc.schoolId) === schoolId;
}

/** Students may only see published content for their own class. */
export function studentVisibleFilter(req: Request, extra: Record<string, unknown> = {}): Record<string, unknown> {
  const classLevel = req.user?.classLevel ?? null;
  const schoolId = req.user?.schoolId ?? null;
  const query: Record<string, unknown> = { ...extra, isPublished: true };
  if (classLevel) query.classLevel = classLevel;
  if (schoolId) {
    query.$or = [
      { schoolId: new Types.ObjectId(schoolId) },
      { schoolId: null, visibility: 'global' },
    ];
  } else {
    query.schoolId = null;
  }
  return query;
}
