import { userRepository } from '../../../repositories/user.repository';
import { uploadBuffer, deleteGridFSFile } from '../../../config/gridfs';
import { AuthPrincipal } from '../auth/auth.service';

/**
 * User service - profile management and avatar uploads.
 */
export const userService = {
  async getProfile(userId: string): Promise<AuthPrincipal | null> {
    const user = await userRepository.findById(userId);
    if (!user) return null;

    return {
      id: String(user._id),
      role: 'user',
      email: user.email,
      name: user.name,
      avatarUrl: user.avatarUrl || null,
    };
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

    return {
      id: String(updated._id),
      role: 'user',
      email: updated.email,
      name: updated.name,
      avatarUrl: updated.avatarUrl || null,
    };
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

    return {
      id: String(updated._id),
      role: 'user',
      email: updated.email,
      name: updated.name,
      avatarUrl: updated.avatarUrl || null,
    };
  },
};

export default userService;
