import { ObjectId } from 'mongodb';
import type { Role } from '../constants';

/** The authenticated principal attached to `req` by the auth middleware. */
export interface AuthUser {
  id: string;
  role: Role;
  email: string;
  name: string;
  avatarUrl?: string | null;
  schoolId?: string | null;
  schoolName?: string | null;
  classLevel?: number | null;
}

/** Express Request augmentation. */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      userId?: string;
      userRole?: Role;
      requestId?: string;
    }
  }
}

export interface PaginationQuery {
  page: number;
  limit: number;
  skip: number;
}

export function toObjectId(id: string): ObjectId | null {
  try {
    return new ObjectId(id);
  } catch {
    return null;
  }
}
