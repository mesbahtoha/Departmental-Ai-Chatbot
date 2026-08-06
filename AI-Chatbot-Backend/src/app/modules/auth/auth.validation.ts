import { z } from 'zod';

export const registerSchema = z.object({
  name: z.string().trim().min(2, 'Name must be at least 2 characters').max(80),
  email: z.string().trim().email('Invalid email address').max(120),
  password: z.string().min(6, 'Password must be at least 6 characters').max(72),
});

export const loginSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(120),
  password: z.string().min(1, 'Password is required').max(72),
});

export const refreshSchema = z.object({
  refreshToken: z.string().min(10, 'Invalid refresh token'),
});

export const forgotPasswordSchema = z.object({
  email: z.string().trim().email('Invalid email address').max(120),
});

export const resetPasswordSchema = z.object({
  token: z.string().min(10, 'Invalid reset token'),
  password: z.string().min(6, 'Password must be at least 6 characters').max(72),
});

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z.string().min(6, 'New password must be at least 6 characters').max(72),
});
