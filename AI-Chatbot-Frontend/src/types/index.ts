// Shared API types for the NoticeFlow frontend.

export interface ApiError {
  success: false;
  message: string;
  error?: string;
  code?: string;
}

export interface AuthUser {
  id: string;
  role: 'admin' | 'user';
  email: string;
  name: string;
  avatarUrl?: string | null;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

export interface QuotaWindow {
  used: number;
  limit: number;
  remaining: number;
}

export interface QuotaStatus {
  daily: QuotaWindow;
  monthly: QuotaWindow;
  exhausted: boolean;
}

export interface UserUsage {
  quota: QuotaStatus;
  today?: {
    chats: number;
    tokens: number;
  };
  total?: {
    chats: number;
    tokens: number;
  };
}

export interface Conversation {
  _id: string;
  title: string;
  pinned: boolean;
  isArchived: boolean;
  shareToken: string | null;
  shareEnabled: boolean;
  userId: string;
  createdAt: string;
  updatedAt: string;
  lastMessageAt?: string | null;
  messageCount?: number;
}

export interface Citation {
  sourceNumber: number;
  title: string;
  category: string;
  excerpt: string;
  chunkIndex: number;
  reason: string;
  noticeId?: string | null;
  fileId?: string | null;
  fileUrl?: string | null;
  fullNoticeUrl?: string | null;
  mimeType?: string | null;
}

export interface Source {
  noticeId: string;
  title: string;
  category: string;
  fileUrl: string | null;
  fullNoticeUrl: string;
  mimeType?: string | null;
}

export type MessageRole = 'user' | 'assistant' | 'system';
export type MessageStatus = 'pending' | 'streaming' | 'complete' | 'stopped' | 'error';

export interface MessageFeedback {
  type: 'like' | 'dislike';
  comment?: string;
}

export interface ChatMessage {
  _id: string;
  conversation: string;
  user: string;
  role: MessageRole;
  content: string;
  status: MessageStatus;
  model?: string;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  citations?: Citation[];
  sources?: Source[];
  feedback?: MessageFeedback | null;
  createdAt: string;
  updatedAt: string;
}

export interface ConversationDetail {
  conversation: Conversation;
  messages: ChatMessage[];
}

export interface SharedChat {
  title: string;
  ownerName: string;
  createdAt: string;
  messages: { role: MessageRole; content: string; createdAt: string }[];
}

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
}

// ---- SSE stream events (POST /api/v1/conversations/:id/messages) ----
export type StreamEvent =
  | { type: 'start'; messageId: string; conversationId: string }
  | { type: 'token'; content: string }
  | { type: 'usage'; promptTokens: number; completionTokens: number; totalTokens: number; remaining: number; dailyLimit: number; dailyUsed: number; exhausted: boolean }
  | { type: 'done'; messageId: string; status: string; finishReason: string; model: string }
  | { type: 'error'; message: string }
  | { type: 'citations'; citations: Citation[]; sources: Source[] };

// ---- Admin ----
export interface AdminUser {
  _id: string;
  name: string;
  email: string;
  role: string;
  isActive: boolean;
  avatarUrl?: string | null;
  createdAt: string;
  lastLoginAt?: string | null;
  usage?: {
    today: { chats: number; tokens: number };
    total: { chats: number; tokens: number };
  };
}

export interface AdminNotice {
  _id: string;
  title: string;
  category: string;
  type: string;
  mimeType?: string;
  summary?: string;
  createdAt: string;
  fileId?: string | null;
  fileUrl?: string | null;
  hasFullText?: boolean;
  chunkCount?: number;
}

export interface ChatLogEntry {
  _id: string;
  userId?: string | null;
  userName?: string;
  query: string;
  answer: string;
  mode: string;
  confidence?: string;
  sources?: Source[];
  citations?: Citation[];
  createdAt: string;
  feedback?: { type: string; comment?: string } | null;
}

export interface DashboardStats {
  users: { total: number; newToday: number; activeToday: number };
  conversations: number;
  messages: number;
  notices: { total: number; byCategory: Record<string, number> };
  feedback: { total: number; likes: number; dislikes: number };
  usageToday: { tokens: number; chats: number; cost?: number };
  quota: {
    dailyLimit: number;
    dailyUsed: number;
    monthlyLimit: number;
    monthlyUsed: number;
  };
  charts?: {
    messagesByDay: { date: string; count: number }[];
    usageByDay: { date: string; tokens: number }[];
  };
  recentUsers?: AdminUser[];
  recentChats?: ChatLogEntry[];
}

export interface UsagePoint {
  date: string;
  tokens: number;
  chats: number;
  cost?: number;
}

export interface TokenOverview {
  today: { tokens: number; chats: number; cost?: number };
  month: { tokens: number; chats: number; cost?: number };
  total: { tokens: number; chats: number; cost?: number };
  dailyLimit: number;
  monthlyLimit: number;
  byModel?: { model: string; tokens: number; chats: number }[];
  topUsers?: { userId: string; name?: string; email?: string; tokens: number; chats: number }[];
}

export interface SettingsEntry {
  key: string;
  value: unknown;
  group?: string;
  description?: string;
}

export interface PromptTemplate {
  _id: string;
  name: string;
  key: string;
  description?: string;
  content: string;
  isActive: boolean;
  isDefault?: boolean;
  createdAt: string;
}

export interface LogRecord {
  _id: string;
  level: string;
  message: string;
  meta?: Record<string, unknown>;
  timestamp: string;
}

export interface SystemInfo {
  status: string;
  uptime: number;
  nodeVersion: string;
  memory: { rss: number; heapUsed: number; heapTotal: number };
  database: {
    connected: boolean;
    name: string;
    host?: string;
  };
  env: string;
  version: string;
  model?: string;
  apiKeyConfigured?: boolean;
  queue?: { pending: number; processing: number };
  routes?: number;
}
