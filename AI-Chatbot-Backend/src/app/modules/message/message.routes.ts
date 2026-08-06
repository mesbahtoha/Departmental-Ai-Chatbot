import { Router } from 'express';
import { validate } from '../../../middleware/validate.middleware';
import messageController from './message.controller';
import { feedbackSchema, regenerateSchema, sendMessageSchema, continueSchema } from './message.validation';
import { aiLimiter } from '../../../middleware/rateLimiter.middleware';

const router = Router({ mergeParams: true });

/**
 * Chat message endpoints.
 * POST /api/v1/conversations/:conversationId/messages  -> SSE stream
 * POST /api/v1/conversations/:conversationId/messages/regenerate -> SSE stream
 * POST /api/v1/conversations/:conversationId/messages/continue -> SSE stream
 * POST /api/v1/conversations/:conversationId/messages/:messageId/feedback
 */
router.post('/', aiLimiter, validate(sendMessageSchema), messageController.sendMessage);
router.post('/regenerate', aiLimiter, validate(regenerateSchema), messageController.regenerate);
router.post('/continue', aiLimiter, validate(continueSchema), messageController.continue);
router.post('/:messageId/feedback', validate(feedbackSchema), messageController.feedback);

export default router;
