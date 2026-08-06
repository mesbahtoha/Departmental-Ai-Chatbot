import { Router } from 'express';
import legacyController from './legacy.controller';
import { authenticate, optionalAuthenticate } from '../../../middleware/auth.middleware';
import { requireAdmin } from '../../../middleware/role.middleware';
import { uploadNoticeFile } from '../../../middleware/upload.middleware';
import { asyncHandler } from '../../../utils/response.utils';

/**
 * Legacy compatibility routes.
 * These mirror the original single-file server's endpoints exactly
 * (same paths, same request fields, same response shapes).
 *
 * Security note: the legacy admin notice endpoints now require a valid
 * admin JWT (the original had no auth at all). Response contracts are
 * unchanged. Public endpoints (/api/student/*, /api/ai/ask,
 * /api/feedback, /api/files/:fileId) stay open as before.
 */
export function listRoutes(): string[] {
  return [
    'GET /',
    'GET /api/test',
    'GET /api/routes',
    'GET /users',
    'POST /users',
    'POST /api/admin/notices',
    'GET /api/admin/notices',
    'GET /api/admin/notices/:id',
    'PUT /api/admin/notices/:id',
    'POST /api/admin/notices/:id/reindex',
    'DELETE /api/admin/notices/:id',
    'GET /api/files/:fileId',
    'GET /api/student/search',
    'GET /api/student/notices/:id/full',
    'POST /api/student/query',
    'POST /api/ai/ask',
    'POST /api/feedback',
  ];
}

const legacyRouter = Router();

// Root + meta
legacyRouter.get('/', legacyController.home);
legacyRouter.get('/api/test', legacyController.test);
legacyRouter.get('/api/routes', legacyController.routes);

// Dev user endpoints (kept for compatibility)
legacyRouter.get('/users', legacyController.listLegacyUsers);
legacyRouter.post('/users', legacyController.createLegacyUser);

// Admin notice management (now JWT-protected; same responses)
legacyRouter.post(
  '/api/admin/notices',
  authenticate,
  requireAdmin,
  uploadNoticeFile.single('file'),
  legacyController.createNotice
);
legacyRouter.get('/api/admin/notices', authenticate, requireAdmin, legacyController.listNotices);
legacyRouter.get('/api/admin/notices/:id', authenticate, requireAdmin, legacyController.getNotice);
legacyRouter.put('/api/admin/notices/:id', authenticate, requireAdmin, legacyController.updateNotice);
legacyRouter.post(
  '/api/admin/notices/:id/reindex',
  authenticate,
  requireAdmin,
  legacyController.reindexNotice
);
legacyRouter.delete('/api/admin/notices/:id', authenticate, requireAdmin, legacyController.deleteNotice);

// Public file streaming
legacyRouter.get('/api/files/:fileId', legacyController.streamFile);

// Public student endpoints
legacyRouter.get('/api/student/search', legacyController.studentSearch);
legacyRouter.get('/api/student/notices/:id/full', legacyController.fullNotice);
legacyRouter.post('/api/student/query', legacyController.studentQuery);

// Public AI endpoint
legacyRouter.post('/api/ai/ask', legacyController.aiAsk);

// Public feedback endpoint
legacyRouter.post('/api/feedback', legacyController.feedback);

export default legacyRouter;
