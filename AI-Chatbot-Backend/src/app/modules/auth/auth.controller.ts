import { Request, Response } from 'express';
import { asyncHandler, fail, ok } from '../../../utils/response.utils';
import authService from './auth.service';
import env from '../../../config/env';

const ACCESS_COOKIE = 'access_token';
const REFRESH_COOKIE = 'refresh_token';

function setAuthCookies(res: Response, tokens: { accessToken: string; refreshToken: string }) {
  const secure = env.isProduction;
  res.cookie(ACCESS_COOKIE, tokens.accessToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 15 * 60 * 1000,
    path: '/',
  });
  res.cookie(REFRESH_COOKIE, tokens.refreshToken, {
    httpOnly: true,
    secure,
    sameSite: 'lax',
    maxAge: 30 * 24 * 60 * 60 * 1000,
    path: '/',
  });
}

function clearAuthCookies(res: Response) {
  res.clearCookie(ACCESS_COOKIE, { path: '/' });
  res.clearCookie(REFRESH_COOKIE, { path: '/' });
}

export const authController = {
  register: asyncHandler(async (req: Request, res: Response) => {
    const { user, tokens } = await authService.register(req.body);
    setAuthCookies(res, tokens);
    ok(res, { user, tokens });
  }),

  login: asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const { user, tokens } = await authService.loginUser(email, password);
    setAuthCookies(res, tokens);
    ok(res, { user, tokens });
  }),

  loginAdmin: asyncHandler(async (req: Request, res: Response) => {
    const { email, password } = req.body;
    const { user, tokens } = await authService.loginAdmin(email, password);
    setAuthCookies(res, tokens);
    ok(res, { user, tokens });
  }),

  refresh: asyncHandler(async (req: Request, res: Response) => {
    const refreshToken =
      req.body.refreshToken || req.cookies?.refresh_token || '';

    if (!refreshToken) {
      return fail(res, 401, 'Refresh token required');
    }

    const { user, tokens } = await authService.refreshTokens(refreshToken);
    setAuthCookies(res, tokens);
    ok(res, { user, tokens });
  }),

  logout: asyncHandler(async (req: Request, res: Response) => {
    const refreshToken = req.body.refreshToken || req.cookies?.refresh_token || '';
    await authService.logout(refreshToken);
    clearAuthCookies(res);
    ok(res, { message: 'Logged out successfully' });
  }),

  me: asyncHandler(async (req: Request, res: Response) => {
    const user = await authService.getPrincipal(req.user!.id, req.user!.role);
    if (!user) return fail(res, 404, 'User not found');
    ok(res, { user });
  }),

  forgotPassword: asyncHandler(async (req: Request, res: Response) => {
    const { email } = req.body;
    const { previewLink } = await authService.forgotPassword(email);
    ok(res, {
      message: 'If an account exists for this email, a reset link has been sent.',
      previewLink: env.isDevelopment ? previewLink : null,
    });
  }),

  resetPassword: asyncHandler(async (req: Request, res: Response) => {
    const { token, password } = req.body;
    await authService.resetPassword(token, password);
    ok(res, { message: 'Password reset successfully. You can now log in.' });
  }),

  changePassword: asyncHandler(async (req: Request, res: Response) => {
    await authService.changePassword(
      req.user!.id,
      req.body.currentPassword,
      req.body.newPassword
    );
    ok(res, { message: 'Password changed successfully. Please log in again.' });
  }),
};

export default authController;
