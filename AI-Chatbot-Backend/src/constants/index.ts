/**
 * Domain constants shared across the backend.
 */

/**
 * Four-level RBAC.
 * - superadmin/admin : platform owner (admin collection)
 * - school_admin     : manages one school or coaching centre
 * - teacher          : creates questions, sets, assessments and materials
 * - student          : takes assessments, uses the AI tutor
 * - user             : legacy name kept for existing student accounts
 */
export const ROLES = {
  SUPER_ADMIN: 'superadmin',
  ADMIN: 'admin',
  SCHOOL_ADMIN: 'school_admin',
  TEACHER: 'teacher',
  STUDENT: 'student',
  USER: 'user',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

/** Roles that own the platform (admin collection). */
export const PLATFORM_ROLES: Role[] = ['superadmin', 'admin'];
/** Roles that can manage academic content. */
export const STAFF_ROLES: Role[] = ['superadmin', 'admin', 'school_admin', 'teacher'];

export function isPlatformRole(role?: string | null): boolean {
  return role === 'superadmin' || role === 'admin';
}

export function isStaffRole(role?: string | null): boolean {
  return isPlatformRole(role) || role === 'school_admin' || role === 'teacher';
}

/** Classes supported by the platform. */
export const CLASS_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10] as const;
export type ClassLevel = (typeof CLASS_LEVELS)[number];

export function classLabel(level?: number | null): string {
  return level ? `Class ${level}` : 'All classes';
}

export const NOTICE_CATEGORIES = [
  'general',
  'exam',
  'routine',
  'result',
  'admission',
  'scholarship',
] as const;

export const MESSAGE_ROLES = ['user', 'assistant', 'system'] as const;
export type MessageRole = (typeof MESSAGE_ROLES)[number];

export const MESSAGE_STATUS = [
  'pending',
  'streaming',
  'complete',
  'stopped',
  'error',
] as const;
export type MessageStatus = (typeof MESSAGE_STATUS)[number];

export const QUOTA_EXCEEDED_MESSAGE =
  'Your AI API quota has been exhausted. Please try again later or contact the administrator.';

export const DEFAULT_PROMPT_TEMPLATES = [
  {
    name: 'Helpful Assistant',
    key: 'helpful-assistant',
    description: 'Default friendly, knowledgeable assistant persona.',
    content:
      'You are a helpful, accurate, and friendly AI assistant. Answer clearly, prefer concise but complete responses, and be honest when you do not know something.',
    isActive: true,
    isDefault: true,
  },
  {
    name: 'Notice Assistant (RAG)',
    key: 'notice-assistant',
    description: 'Answers strictly from uploaded department notices.',
    content:
      'You are a university department notice assistant.\nYour job:\n- Answer ONLY from the provided notice context.\n- Be accurate, grounded, and helpful.\n- Never invent facts. If the exact answer is not present, say so clearly.\n- Use the same language as the user\'s question.\n- Prefer the most specific date, deadline, time, exam, routine, admission, result, scholarship, or official instruction found in the sources.\n- If multiple notices conflict, prefer the most relevant source and mention uncertainty briefly.\n- Keep answers concise but complete.',
    isActive: false,
    isDefault: false,
  },
] as const;

export const DEFAULT_SETTINGS = {
  'app.title': 'Shikhi Bondhu, Class 3 Tutor',
  'app.tagline': 'Ask anything. Get instant answers.',
  'app.allowRegistration': true,
  'ai.provider': 'openrouter',
  'ai.model': 'google/gemini-2.5-flash-lite',
  'ai.modelFast': 'google/gemini-2.5-flash-lite',
  'ai.modelAccurate': 'google/gemini-2.5-pro',
  'ai.temperature': 0.3,
  'ai.maxTokens': 700,
  'ai.timeoutMs': 45000,
  'ai.fallbacks': [],
  'ai.systemPrompt': '',
  'ai.dailyQuotaPerUser': 40000,
  'ai.monthlyQuotaPerUser': 0,
  'ai.openRouterApiKey': '',
  'ai.anthropicApiKey': '',
  'ai.geminiApiKey': '',
  'ai.compatibleBaseUrl': '',
  'ai.compatibleApiKey': '',
  'ai.compatibleModel': '',
  'ui.showTokenUsage': true,
  'ui.showSuggestedPrompts': true,
} as const;

/**
 * AI response modes selectable from the chat composer.
 * 'balanced' always uses the admin-configured default model (ai.model) so
 * existing deployments keep their current behavior.
 */
export const AI_MODES = ['fast', 'balanced', 'accurate'] as const;
export type AIMode = (typeof AI_MODES)[number];

/** Temporary chat attachments (upload -> analyze -> answer -> discard). */
export const CHAT_ATTACHMENT_LIMITS = {
  maxSizeBytes: 10 * 1024 * 1024,
  maxFilesPerMessage: 5,
  ttlMs: 30 * 60 * 1000,
} as const;

export type SettingKey = keyof typeof DEFAULT_SETTINGS;
