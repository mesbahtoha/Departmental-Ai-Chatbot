import { userRepository } from '../../../repositories/user.repository';
import { uploadBuffer, deleteGridFSFile } from '../../../config/gridfs';
import { SchoolModel } from '../../../database/models/School.model';
import { AuthPrincipal } from '../auth/auth.service';

function toPrincipal(
  user: {
    _id: unknown;
    role: string;
    email: string;
    name: string;
    avatarUrl?: string | null;
    schoolId?: unknown;
    classLevel?: number | null;
  }
): Promise<AuthPrincipal> {
  const schoolId = user.schoolId ? String(user.schoolId) : null;
  const schoolPromise = schoolId
    ? SchoolModel.findById(user.schoolId as string).select('name').lean()
    : Promise.resolve(null);

  // eslint-disable-next-line @typescript-eslint/no-floating-promises
  return schoolPromise.then((school) => ({
    id: String(user._id),
    role: user.role as AuthPrincipal['role'],
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl || null,
    schoolId,
    schoolName: school?.name ?? null,
    classLevel: user.classLevel ?? null,
  }));
}

/**
 * User service - profile management, avatar uploads and self-service context.
 */
export const userService = {
  async getProfile(userId: string): Promise<AuthPrincipal | null> {
    const user = await userRepository.findById(userId);
    if (!user) return null;

    return toPrincipal(user);
  },

  async updateProfile(
    userId: string,
    data: { name?: string; email?: string }
  ): Promise<AuthPrincipal | null> {
    const user = await userRepository.findById(userId);
    if (!user) return null;

    if (data.email && data.email.toLowerCase() !== user.email) {
      const existing = await userRepository.findByEmail(data.email);
      if (existing && String(existing._id) !== userId) {
        const error = new Error('An account with this email already exists') as Error & { statusCode?: number };
        error.statusCode = 409;
        throw error;
      }
    }

    const updated = await userRepository.update(userId, {
      name: data.name,
      email: data.email,
    });

    if (!updated) return null;

    return toPrincipal(updated);
  },

  /** Uploads an avatar image to GridFS and links it to the user. */
  async uploadAvatar(userId: string, file: Express.Multer.File): Promise<AuthPrincipal | null> {
    const user = await userRepository.findById(userId);
    if (!user) return null;

    const fileId = await uploadBuffer(
      file.buffer,
      `avatar-${userId}-${Date.now()}.${file.originalname.split('.').pop() || 'img'}`,
      file.mimetype,
      { userId, purpose: 'avatar' }
    );

    // Remove the old avatar (best effort).
    if (user.avatarUrl && user.avatarUrl.startsWith('http')) {
      const oldId = user.avatarUrl.split('/').pop();
      if (oldId) await deleteGridFSFile(oldId).catch(() => undefined);
    }

    const avatarUrl = `/api/files/${String(fileId)}`;
    const updated = await userRepository.update(userId, { avatarUrl });

    if (!updated) return null;

    return toPrincipal(updated);
  },
};

export default userService;
