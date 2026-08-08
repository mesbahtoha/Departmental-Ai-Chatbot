import { z } from 'zod';

export const languageSchema = z.enum(['auto', 'en', 'bn', 'banglish']).optional();

export const modeSchema = z.enum(['fast', 'balanced', 'accurate']).optional();

export const attachmentSchema = z.object({
  id: z.string().min(1, 'attachment id is required'),
  type: z.enum(['image', 'pdf']),
  name: z.string().max(200).optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message cannot be empty').max(20000),
  language: languageSchema,
  mode: modeSchema,
  attachments: z.array(attachmentSchema).max(5).optional(),
});

export const regenerateSchema = z.object({
  messageId: z.string().min(1, 'messageId is required'),
  language: languageSchema,
  mode: modeSchema,
});

export const continueSchema = z.object({
  language: languageSchema,
  mode: modeSchema,
});

export const feedbackSchema = z.object({
  type: z.enum(['like', 'dislike']),
  comment: z.string().trim().max(500).optional(),
});
