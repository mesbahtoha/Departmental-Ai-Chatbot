/**
 * Domain constants shared across the backend.
 */

export const ROLES = {
  ADMIN: 'admin',
  USER: 'user',
} as const;

export type Role = (typeof ROLES)[keyof typeof ROLES];

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
  'app.title': 'AI Chatbot',
  'app.tagline': 'Ask anything. Get instant answers.',
  'app.allowRegistration': true,
  'ai.model': 'google/gemini-2.5-flash-lite',
  'ai.temperature': 0.15,
  'ai.maxTokens': 700,
  'ai.systemPrompt': '',
  'ai.dailyQuotaPerUser': 40000,
  'ai.monthlyQuotaPerUser': 0,
  'ai.openRouterApiKey': '',
  'ui.showTokenUsage': true,
  'ui.showSuggestedPrompts': true,
} as const;

export type SettingKey = keyof typeof DEFAULT_SETTINGS;
