import { Router } from 'express';
import { authenticate } from '../../../middleware/auth.middleware';
import { validate } from '../../../middleware/validate.middleware';
import conversationController from './conversation.controller';
import {
  createConversationSchema,
  listConversationsSchema,
  updateConversationSchema,
} from './conversation.validation';
import messageRouter from '../message/message.routes';

const router = Router();

// Public: shared conversation page (no auth).
router.get('/share/:token', conversationController.shared);

router.use(authenticate);

router.get('/', validate(listConversationsSchema, 'query'), conversationController.list);
router.post('/', validate(createConversationSchema), conversationController.create);
router.delete('/clear-all', conversationController.clearAll);

router.get('/:id', conversationController.getById);
router.patch('/:id', validate(updateConversationSchema), conversationController.update);
router.delete('/:id', conversationController.remove);
router.get('/:id/export', conversationController.exportChat);
router.post('/:id/share', conversationController.toggleShare);

// Nested message routes (streaming chat lives here).
router.use('/:conversationId/messages', messageRouter);

export default router;
