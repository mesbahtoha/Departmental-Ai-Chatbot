import { ObjectId } from 'mongodb';

/** The authenticated principal attached to `req` by the auth middleware. */
export interface AuthUser {
  id: string;
  role: 'admin' | 'user';
  email: string;
  name: string;
  avatarUrl?: string | null;
}

/** Express Request augmentation. */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      userId?: string;
      userRole?: 'admin' | 'user';
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
