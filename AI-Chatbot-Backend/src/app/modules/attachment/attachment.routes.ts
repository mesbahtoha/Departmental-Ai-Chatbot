import { Router, Request, Response, NextFunction } from 'express';
import multer from 'multer';
import { authenticate } from '../../../middleware/auth.middleware';
import { uploadChatAttachments } from '../../../middleware/upload.middleware';
import attachmentController from './attachment.controller';

const router = Router();

/**
 * Temporary chat attachments.
 * POST /api/v1/attachments -> multipart upload (images / PDFs, max 10 MB each, 5 per message).
 */
router.post(
  '/',
  authenticate,
  (req: Request, res: Response, next: NextFunction) => {
    uploadChatAttachments.array('files', 5)(req, res, (error) => {
      if (!error) return next();

      if (error instanceof multer.MulterError) {
        if (error.code === 'LIMIT_FILE_SIZE') {
          return res.status(413).json({
            success: false,
            message: 'File too large. Please upload a file smaller than 10 MB.',
          });
        }
        if (error.code === 'LIMIT_FILE_COUNT') {
          return res.status(400).json({
            success: false,
            message: 'You can attach up to 5 files in a single message.',
          });
        }
        return res.status(400).json({ success: false, message: error.message });
      }

      const err = error as Error;
      return res.status(400).json({
        success: false,
        message: err.message || 'Invalid file upload.',
      });
    });
  },
  attachmentController.upload
);

export default router;
