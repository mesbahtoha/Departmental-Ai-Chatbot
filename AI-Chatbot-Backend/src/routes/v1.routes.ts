import { Router } from 'express';
import authRoutes from '../app/modules/auth/auth.routes';
import userRoutes from '../app/modules/user/user.routes';
import conversationRoutes from '../app/modules/conversation/conversation.routes';
import adminRoutes from '../app/modules/admin/admin.routes';
import attachmentRoutes from '../app/modules/attachment/attachment.routes';
import booksRoutes from '../app/modules/books/books.routes';
import tutorRoutes from '../app/modules/tutor/tutor.routes';
import schoolsRoutes from '../app/modules/schools/schools.routes';
import questionsRoutes from '../app/modules/questions/questions.routes';
import questionSetsRoutes from '../app/modules/question-sets/question-sets.routes';
import assessmentsRoutes from '../app/modules/assessments/assessments.routes';
import materialsRoutes from '../app/modules/materials/materials.routes';
import notificationsRoutes from '../app/modules/notifications/notifications.routes';

/**
 * Versioned API router (/api/v1).
 */
const v1Router = Router();

v1Router.use('/auth', authRoutes);
v1Router.use('/users', userRoutes);
v1Router.use('/conversations', conversationRoutes);
v1Router.use('/admin', adminRoutes);
v1Router.use('/attachments', attachmentRoutes);
v1Router.use('/books', booksRoutes);
v1Router.use('/tutor', tutorRoutes);
v1Router.use('/schools', schoolsRoutes);
v1Router.use('/questions', questionsRoutes);
v1Router.use('/question-sets', questionSetsRoutes);
v1Router.use('/assessments', assessmentsRoutes);
v1Router.use('/materials', materialsRoutes);
v1Router.use('/notifications', notificationsRoutes);

v1Router.get('/health', (_req, res) => {
  res.json({ success: true, status: 'ok', time: new Date().toISOString() });
});

export default v1Router;
