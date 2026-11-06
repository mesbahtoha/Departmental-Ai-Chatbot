import { NextFunction, Request, Response } from 'express';
import { Role, STAFF_ROLES, isPlatformRole } from '../constants';

/**
 * Role guard - restricts a route to specific roles.
 * Must run AFTER `authenticate`.
 */
export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'Authentication required' });
    }

    if (!roles.includes(req.user.role as Role)) {
      return res.status(403).json({ success: false, message: 'Forbidden: insufficient permissions' });
    }

    next();
  };
}

/** Platform owners (Super Admin / Admin). */
export const requireAdmin = requireRole('admin', 'superadmin');
/** Anyone who can author academic content. */
export const requireStaff = requireRole(...STAFF_ROLES);
/** School-level management only. */
export const requireSchoolAdmin = requireRole('school_admin');
/** Teachers (and school admins can act on their behalf). */
export const requireTeacher = requireRole('teacher');
/** Student-facing endpoints. */
export const requireStudent = requireRole('student', 'user');

/**
 * Ensures school-scoped roles actually belong to a school.
 * Platform admins pass through. Also exposes `req.schoolId`.
 */
export function requireSchoolScope(req: Request, res: Response, next: NextFunction) {
  if (!req.user) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }
  if (isPlatformRole(req.user.role)) {
    return next();
  }
  if (!req.user.schoolId) {
    return res.status(403).json({
      success: false,
      message: 'Your account is not linked to a school. Please contact your administrator.',
    });
  }
  (req as Request & { schoolId?: string }).schoolId = req.user.schoolId;
  next();
}

export function isPlatform(req: Request): boolean {
  return isPlatformRole(req.user?.role);
}
