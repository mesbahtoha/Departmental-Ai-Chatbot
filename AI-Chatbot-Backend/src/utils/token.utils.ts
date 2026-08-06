import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import env from '../config/env';

export interface AccessTokenPayload {
  sub: string;
  role: 'admin' | 'user';
  type: 'access';
}

export interface RefreshTokenPayload {
  sub: string;
  type: 'refresh';
}

/** Signs a short-lived access token. */
export function signAccessToken(userId: string, role: 'admin' | 'user'): string {
  return jwt.sign(
    { sub: userId, role, type: 'access' } as AccessTokenPayload,
    env.jwt.accessSecret,
    { expiresIn: env.jwt.accessExpiresIn as jwt.SignOptions['expiresIn'] }
  );
}

/** Signs a long-lived refresh token. */
export function signRefreshToken(userId: string): string {
  return jwt.sign(
    { sub: userId, type: 'refresh' } as RefreshTokenPayload,
    env.jwt.refreshSecret,
    { expiresIn: env.jwt.refreshExpiresIn as jwt.SignOptions['expiresIn'] }
  );
}

/** Verifies an access token; returns the payload or null. */
export function verifyAccessToken(token: string): AccessTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.jwt.accessSecret) as AccessTokenPayload;
    return decoded.type === 'access' ? decoded : null;
  } catch {
    return null;
  }
}

/** Verifies a refresh token; returns the payload or null. */
export function verifyRefreshToken(token: string): RefreshTokenPayload | null {
  try {
    const decoded = jwt.verify(token, env.jwt.refreshSecret) as RefreshTokenPayload;
    return decoded.type === 'refresh' ? decoded : null;
  } catch {
    return null;
  }
}

/** Generates a random opaque token (password reset, share links). */
export function generateRandomToken(bytes = 32): string {
  return crypto.randomBytes(bytes).toString('hex');
}

/** SHA-256 hashes a token for safe at-rest storage (refresh tokens, resets). */
export function hashToken(token: string): string {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function maskSecret(value: string): string {
  if (!value) return '';
  if (value.length <= 8) return '********';
  return `${value.slice(0, 4)}...${value.slice(-4)}`;
}
