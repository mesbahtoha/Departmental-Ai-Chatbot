import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { requireAdmin } from '../../../middleware/role.middleware';
import { validate } from '../../../middleware/validate.middleware';
import adminController from './admin.controller';
import {
  analyticsRangeSchema,
  createNoticeSchema,
  createTemplateSchema,
  listChatsSchema,
  listLogsSchema,
  listUsersSchema,
  updateNoticeSchema,
  updateSettingsSchema,
  updateTemplateSchema,
  updateUserSchema,
} from './admin.validation';
import { uploadNoticeFile } from '../../../middleware/upload.middleware';

const router = Router();

router.use(authenticate, requireAdmin);

// Dashboard
router.get('/dashboard', adminController.dashboard);

// Users
router.get('/users', validate(listUsersSchema, 'query'), adminController.listUsers);
router.patch('/users/:id', validate(updateUserSchema), adminController.updateUser);
router.delete('/users/:id', adminController.deleteUser);

// Notices
router.get('/notices', adminController.listNotices);
router.get('/notices/:id', adminController.getNotice);
router.post('/notices', uploadNoticeFile.single('file'), validate(createNoticeSchema), adminController.createNotice);
router.put('/notices/:id', validate(updateNoticeSchema), adminController.updateNotice);
router.post('/notices/:id/reindex', adminController.reindexNotice);
router.delete('/notices/:id', adminController.deleteNotice);

// Chat history
router.get('/chats', validate(listChatsSchema, 'query'), adminController.chatHistory);

// Analytics + tokens
router.get('/analytics/usage', validate(analyticsRangeSchema, 'query'), adminController.analytics);
router.get('/tokens/usage', adminController.tokenOverview);

// Settings
router.get('/settings', adminController.getSettings);
router.put('/settings', validate(updateSettingsSchema), adminController.updateSettings);
router.get('/settings/api-key', adminController.getApiKeyStatus);

// Prompt templates
router.get('/prompt-templates', adminController.listTemplates);
router.post('/prompt-templates', validate(createTemplateSchema), adminController.createTemplate);
router.patch('/prompt-templates/:id', validate(updateTemplateSchema), adminController.updateTemplate);
router.delete('/prompt-templates/:id', adminController.deleteTemplate);

// Logs + system
router.get('/logs', validate(listLogsSchema, 'query'), adminController.listLogs);
router.get('/system', adminController.systemInfo);

export default router;
