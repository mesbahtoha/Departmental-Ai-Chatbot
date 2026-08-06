import { z } from 'zod';

export const listUsersSchema = z.object({
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  email: z.string().trim().email().max(120).optional(),
  isActive: z.boolean().optional(),
  role: z.enum(['user', 'admin']).optional(),
});

export const createNoticeSchema = z.object({
  title: z.string().trim().min(1, 'Title is required').max(200),
  category: z.string().trim().max(50).default('general'),
  textContent: z.string().max(200000).optional(),
});

export const updateNoticeSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  category: z.string().trim().max(50).optional(),
  textContent: z.string().max(200000).optional(),
});

export const updateSettingsSchema = z.object({
  entries: z.array(
    z.object({
      key: z.string().min(1),
      value: z.unknown(),
    })
  ).min(1).max(50),
});

export const createTemplateSchema = z.object({
  name: z.string().trim().min(1).max(120),
  key: z.string().trim().min(1).max(60).regex(/^[a-z0-9-]+$/, 'Key must be lowercase letters, numbers and dashes'),
  description: z.string().max(300).optional(),
  content: z.string().min(1).max(10000),
  isActive: z.boolean().default(true),
});

export const updateTemplateSchema = createTemplateSchema.partial();

export const analyticsRangeSchema = z.object({
  from: z.string().optional(),
  to: z.string().optional(),
  groupBy: z.enum(['day', 'month']).default('day'),
});

export const listLogsSchema = z.object({
  level: z.enum(['error', 'warn', 'info', 'debug', 'http']).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(200).default(50),
});

export const listChatsSchema = z.object({
  search: z.string().trim().max(120).optional(),
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
