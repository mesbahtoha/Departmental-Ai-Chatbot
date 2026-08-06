import { z } from 'zod';

export const languageSchema = z.enum(['auto', 'en', 'bn', 'banglish']).optional();

export const sendMessageSchema = z.object({
  content: z.string().trim().min(1, 'Message cannot be empty').max(20000),
  language: languageSchema,
});

export const regenerateSchema = z.object({
  messageId: z.string().min(1, 'messageId is required'),
  language: languageSchema,
});

export const continueSchema = z.object({
  language: languageSchema,
});

export const feedbackSchema = z.object({
  type: z.enum(['like', 'dislike']),
  comment: z.string().trim().max(500).optional(),
});
