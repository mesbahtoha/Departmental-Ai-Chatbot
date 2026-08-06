import { z } from 'zod';

export const createConversationSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
});

export const updateConversationSchema = z.object({
  title: z.string().trim().min(1).max(120).optional(),
  pinned: z.boolean().optional(),
  isArchived: z.boolean().optional(),
});

export const listConversationsSchema = z.object({
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(30),
});
