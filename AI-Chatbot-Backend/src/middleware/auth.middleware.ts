import { NextFunction, Request, Response } from 'express';
import { verifyAccessToken } from '../utils/token.utils';
import { UserModel } from '../database/models/User.model';
import { AdminModel } from '../database/models/Admin.model';

/**
 * JWT authentication middleware.
 * Attaches `req.user` (AuthUser) when a valid Bearer token is present.
 * Rejects the request when the token is missing/invalid or the account
 * is disabled.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (!token) {
    return res.status(401).json({ success: false, message: 'Authentication required' });
  }

  const payload = verifyAccessToken(token);
  if (!payload) {
    return res.status(401).json({ success: false, message: 'Invalid or expired token' });
  }

  if (payload.role === 'admin') {
    const admin = await AdminModel.findById(payload.sub).select('+passwordHash').lean();
    if (!admin || !admin.isActive) {
      return res.status(401).json({ success: false, message: 'Account is disabled or removed' });
    }
    req.user = {
      id: String(admin._id),
      role: 'admin',
      email: admin.email,
      name: admin.name,
    };
  } else {
    const user = await UserModel.findById(payload.sub).lean();
    if (!user || !user.isActive) {
      return res.status(401).json({ success: false, message: 'Account is disabled or removed' });
    }
    req.user = {
      id: String(user._id),
      role: user.role === 'admin' ? 'admin' : 'user',
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl || null,
    };
  }

  req.userId = req.user.id;
  req.userRole = req.user.role;

  next();
}

/**
 * Optional auth - attaches the user when a valid token exists,
 * but never rejects. Used by legacy compatibility routes.
 */
export async function optionalAuthenticate(req: Request, res: Response, next: NextFunction) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';

  if (token) {
    const payload = verifyAccessToken(token);
    if (payload) {
      if (payload.role === 'admin') {
        const admin = await AdminModel.findById(payload.sub).lean();
        if (admin?.isActive) {
          req.user = { id: String(admin._id), role: 'admin', email: admin.email, name: admin.name };
        }
      } else {
        const user = await UserModel.findById(payload.sub).lean();
        if (user?.isActive) {
          req.user = {
            id: String(user._id),
            role: 'user',
            email: user.email,
            name: user.name,
            avatarUrl: user.avatarUrl || null,
          };
        }
      }
    }
  }

  if (req.user) {
    req.userId = req.user.id;
    req.userRole = req.user.role;
  }

  next();
}
