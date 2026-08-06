import bcrypt from 'bcryptjs';
import { Types } from 'mongoose';
import { userRepository } from '../../../repositories/user.repository';
import { adminRepository } from '../../../repositories/admin.repository';
import { RefreshTokenModel } from '../../../database/models/RefreshToken.model';
import { UserModel } from '../../../database/models/User.model';
import {
  generateRandomToken,
  hashToken,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from '../../../utils/token.utils';
import MailerService from '../../../services/mailer.service';
import { settingsService } from '../../../services/settings.service';
import env from '../../../config/env';
import { log } from '../../../config/logger';

export interface AuthPrincipal {
  id: string;
  role: 'admin' | 'user';
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

const REFRESH_TTL_MS = 30 * 24 * 60 * 60 * 1000; // 30 days

function toPrincipal(user: {
  _id: unknown;
  role: string;
  email: string;
  name: string;
  avatarUrl?: string | null;
}): AuthPrincipal {
  return {
    id: String(user._id),
    role: user.role === 'admin' ? 'admin' : 'user',
    email: user.email,
    name: user.name,
    avatarUrl: user.avatarUrl || null,
  };
}

/**
 * Auth service - registration, login (user + admin), refresh rotation,
 * logout, password reset flows.
 */
export const authService = {
  async register(input: { name: string; email: string; password: string }): Promise<{ user: AuthPrincipal; tokens: AuthTokens }> {
    const appSettings = await settingsService.getAppSettings();
    if (!appSettings.allowRegistration) {
      const error = new Error('Registration is currently disabled by the administrator') as Error & { statusCode?: number };
      error.statusCode = 403;
      throw error;
    }

    const existing = await userRepository.findByEmail(input.email);
    if (existing) {
      const error = new Error('An account with this email already exists') as Error & { statusCode?: number };
      error.statusCode = 409;
      throw error;
    }

    const passwordHash = bcrypt.hashSync(input.password, 10);
    const user = await userRepository.create({
      name: input.name.trim(),
      email: input.email,
      passwordHash,
      role: 'user',
    });

    const tokens = await this.issueTokens(String(user._id), 'user');

    log.info('User registered', { userId: String(user._id), email: user.email });
    return { user: toPrincipal(user), tokens };
  },

  async loginUser(email: string, password: string): Promise<{ user: AuthPrincipal; tokens: AuthTokens }> {
    const user = await userRepository.findByEmailWithPassword(email);
    if (!user) {
      const error = new Error('Invalid email or password') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

    const valid = bcrypt.compareSync(password, user.passwordHash);
    if (!valid) {
      const error = new Error('Invalid email or password') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

    await userRepository.update(user._id, { lastLoginAt: new Date() });
    const tokens = await this.issueTokens(String(user._id), 'user');

    return { user: toPrincipal(user), tokens };
  },

  async loginAdmin(email: string, password: string): Promise<{ user: AuthPrincipal; tokens: AuthTokens }> {
    const admin = await adminRepository.findByEmailWithPassword(email);
    if (!admin) {
      const error = new Error('Invalid admin email or password') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

    const valid = bcrypt.compareSync(password, admin.passwordHash);
    if (!valid) {
      const error = new Error('Invalid admin email or password') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

    await adminRepository.updateLastLogin(admin._id);
    const tokens = await this.issueTokens(String(admin._id), 'admin');

    return {
      user: toPrincipal({ _id: admin._id, role: 'admin', email: admin.email, name: admin.name }),
      tokens,
    };
  },

  /** Issues an access + refresh token pair, persisting the hashed refresh token. */
  async issueTokens(userId: string, role: 'admin' | 'user', previousToken?: string): Promise<AuthTokens> {
    const accessToken = signAccessToken(userId, role);
    const refreshToken = signRefreshToken(userId);

    await RefreshTokenModel.create({
      tokenHash: hashToken(refreshToken),
      userId: new Types.ObjectId(userId),
      expiresAt: new Date(Date.now() + REFRESH_TTL_MS),
      replacedBy: previousToken ? hashToken(previousToken) : null,
    });

    return { accessToken, refreshToken };
  },

  /** Rotates a refresh token; invalidates the old one. */
  async refreshTokens(refreshToken: string): Promise<{ user: AuthPrincipal; tokens: AuthTokens }> {
    const payload = verifyRefreshToken(refreshToken);
    if (!payload) {
      const error = new Error('Invalid or expired refresh token') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

    const stored = await RefreshTokenModel.findOne({
      tokenHash: hashToken(refreshToken),
      revokedAt: null,
      expiresAt: { $gt: new Date() },
    });

    if (!stored) {
      const error = new Error('Invalid or expired refresh token') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

    // Reuse detection: if a token was replaced, revoke the whole family.
    if (stored.replacedBy) {
      await RefreshTokenModel.updateMany(
        { userId: stored.userId },
        { $set: { revokedAt: new Date() } }
      );
      const error = new Error('Session compromised. Please log in again.') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

    // Mark the used token as replaced before issuing a new pair.
    await RefreshTokenModel.updateOne(
      { _id: stored._id },
      { $set: { replacedBy: refreshToken } }
    );

    const role = stored.userId ? await this.resolveRole(stored.userId) : 'user';

    const user = await this.getPrincipal(stored.userId, role);
    if (!user) {
      const error = new Error('Account not found') as Error & { statusCode?: number };
      error.statusCode = 401;
      throw error;
    }

    const tokens = await this.issueTokens(user.id, user.role);
    return { user, tokens };
  },

  async resolveRole(userId: Types.ObjectId): Promise<'admin' | 'user'> {
    const user = await UserModel.findById(userId).lean();
    return user?.role === 'admin' ? 'admin' : 'user';
  },

  async getPrincipal(userId: Types.ObjectId | string, role?: 'admin' | 'user'): Promise<AuthPrincipal | null> {
    if (role === 'admin') {
      const admin = await adminRepository.findById(userId);
      if (!admin) return null;
      return toPrincipal({ _id: admin._id, role: 'admin', email: admin.email, name: admin.name });
    }

    const user = await userRepository.findById(userId);
    if (!user) return null;
    return toPrincipal(user);
  },

  async logout(refreshToken?: string): Promise<void> {
    if (!refreshToken) return;
    await RefreshTokenModel.updateOne(
      { tokenHash: hashToken(refreshToken) },
      { $set: { revokedAt: new Date() } }
    );
  },

  async revokeAllForUser(userId: string): Promise<void> {
    await RefreshTokenModel.updateMany(
      { userId: new Types.ObjectId(userId) },
      { $set: { revokedAt: new Date() } }
    );
  },

  async forgotPassword(email: string): Promise<{ previewLink: string | null }> {
    const user = await userRepository.findByEmail(email);
    if (!user) {
      // Do not reveal whether the email exists - always succeed.
      return { previewLink: null };
    }

    const rawToken = generateRandomToken(32);
    const tokenHash = hashToken(rawToken);
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await userRepository.setResetToken(user._id, tokenHash, expiresAt);

    const resetLink = `${env.appBaseUrl}/reset-password?token=${rawToken}`;

    await MailerService.send({
      to: user.email,
      subject: 'Reset your password',
      text: `Hello ${user.name},\n\nYou requested a password reset. Click the link below to set a new password (valid for 1 hour):\n\n${resetLink}\n\nIf you did not request this, you can safely ignore this email.`,
      html: `<p>Hello <strong>${user.name}</strong>,</p><p>You requested a password reset. Click the button below to set a new password (valid for 1 hour):</p><p><a href="${resetLink}" style="display:inline-block;padding:10px 18px;background:#2563eb;color:#fff;border-radius:8px;text-decoration:none;">Reset password</a></p><p>If you did not request this, you can safely ignore this email.</p>`,
    });

    return { previewLink: resetLink };
  },

  async resetPassword(token: string, newPassword: string): Promise<void> {
    const tokenHash = hashToken(token);
    const user = await userRepository.findByResetToken(tokenHash);

    if (!user) {
      const error = new Error('Invalid or expired reset token') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await UserModel.updateOne(
      { _id: user._id },
      { $set: { passwordHash } }
    );
    await userRepository.clearResetToken(user._id);
    await this.revokeAllForUser(String(user._id));

    log.info('Password reset completed', { userId: String(user._id) });
  },

  async changePassword(userId: string, currentPassword: string, newPassword: string): Promise<void> {
    const user = await userRepository.findById(userId) as never as {
      _id: Types.ObjectId;
      passwordHash: string;
    } | null;
    const withPassword = await UserModel.findById(userId).select('+passwordHash');

    if (!withPassword) {
      const error = new Error('User not found') as Error & { statusCode?: number };
      error.statusCode = 404;
      throw error;
    }

    const valid = bcrypt.compareSync(currentPassword, withPassword.passwordHash);
    if (!valid) {
      const error = new Error('Current password is incorrect') as Error & { statusCode?: number };
      error.statusCode = 400;
      throw error;
    }

    const passwordHash = bcrypt.hashSync(newPassword, 10);
    await UserModel.updateOne({ _id: userId }, { $set: { passwordHash } });
    await this.revokeAllForUser(userId);

    log.info('Password changed', { userId });
  },
};

export default authService;
