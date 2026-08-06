import { Router } from 'express';
import authController from './auth.controller';
import { validate } from '../../../middleware/validate.middleware';
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  refreshSchema,
  registerSchema,
  resetPasswordSchema,
} from './auth.validation';
import { authenticate } from '../../../middleware/auth.middleware';
import { authLimiter } from '../../../middleware/rateLimiter.middleware';

const router = Router();

/**
 * Public auth endpoints.
 */
router.post('/register', authLimiter, validate(registerSchema), authController.register);
router.post('/login', authLimiter, validate(loginSchema), authController.login);
router.post('/login/admin', authLimiter, validate(loginSchema), authController.loginAdmin);
router.post('/refresh', authLimiter, validate(refreshSchema), authController.refresh);
router.post('/logout', authController.logout);
router.post('/forgot-password', authLimiter, validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', authLimiter, validate(resetPasswordSchema), authController.resetPassword);

/**
 * Protected auth endpoints.
 */
router.get('/me', authenticate, authController.me);
router.post('/change-password', authenticate, validate(changePasswordSchema), authController.changePassword);

export default router;
