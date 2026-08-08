import { Request, Response } from 'express';
import { asyncHandler, fail, ok } from '../../../utils/response.utils';
import { storeChatAttachment, countUserAttachments, ChatAttachmentMeta } from '../../../services/attachment.service';
import { CHAT_ATTACHMENT_LIMITS } from '../../../constants';

/**
 * Uploads one or more temporary chat attachments.
 * Files are held in memory only, validated, and discarded after the
 * AI response that uses them is generated (never stored in the DB).
 */
export const attachmentController = {
  upload: asyncHandler(async (req: Request, res: Response) => {
    const files = (req.files as Express.Multer.File[] | undefined) || [];
    if (!files.length) {
      return fail(res, 400, 'No files were uploaded.');
    }

    if (files.length > CHAT_ATTACHMENT_LIMITS.maxFilesPerMessage) {
      return fail(
        res,
        400,
        `You can attach up to ${CHAT_ATTACHMENT_LIMITS.maxFilesPerMessage} files in a single message.`
      );
    }

    const existing = countUserAttachments(req.user!.id);
    if (existing + files.length > CHAT_ATTACHMENT_LIMITS.maxFilesPerMessage * 4) {
      return fail(
        res,
        429,
        'Too many pending uploads. Please send or discard previous attachments first.'
      );
    }

    const stored: ChatAttachmentMeta[] = [];
    for (const file of files) {
      try {
        stored.push(
          storeChatAttachment({
            buffer: file.buffer,
            mimeType: file.mimetype,
            originalName: file.originalname,
            userId: req.user!.id,
          })
        );
      } catch (error) {
        const err = error as Error & { statusCode?: number };
        return fail(res, err.statusCode || 400, err.message || 'Invalid file');
      }
    }

    return ok(res, { attachments: stored });
  }),
};

export default attachmentController;
