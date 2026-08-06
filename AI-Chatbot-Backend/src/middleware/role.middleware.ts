import { NextFunction, Request, Response } from 'express';
import { Role } from '../constants';

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

export const requireAdmin = requireRole('admin');
