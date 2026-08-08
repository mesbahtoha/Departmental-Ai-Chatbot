import crypto from 'crypto';
import { CHAT_ATTACHMENT_LIMITS } from '../constants';
import { log } from '../config/logger';

export type ChatAttachmentType = 'image' | 'pdf';

export interface ChatAttachmentMeta {
  id: string;
  name: string;
  type: ChatAttachmentType;
  mimeType: string;
  size: number;
  createdAt: number;
}

interface StoredAttachment {
  id: string;
  userId: string;
  name: string;
  type: ChatAttachmentType;
  mimeType: string;
  size: number;
  buffer: Buffer;
  createdAt: number;
}

/**
 * Temporary, in-memory storage for chat attachments.
 *
 * Flow: user uploads -> validated & kept here briefly -> consumed when the
 * AI request is built -> deleted after the response is generated.
 *
 * Nothing is ever written to disk or the database, and an expiry sweep
 * guarantees orphaned uploads are dropped even if a request never completes.
 */
const store = new Map<string, StoredAttachment>();

function sanitizeFileName(name: string): string {
  const base = String(name || 'file')
    .replace(/[\\/:*?"<>|\u0000-\u001f]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 120)
    .trim();
  return base || 'file';
}

function detectType(mimeType: string): ChatAttachmentType | null {
  if (mimeType === 'application/pdf') return 'pdf';
  if (mimeType.startsWith('image/')) return 'image';
  return null;
}

function sweepExpired(): number {
  const now = Date.now();
  let removed = 0;
  for (const [id, item] of store) {
    if (now - item.createdAt > CHAT_ATTACHMENT_LIMITS.ttlMs) {
      store.delete(id);
      removed += 1;
    }
  }
  return removed;
}

let sweepInterval: NodeJS.Timeout | null = null;

function ensureSweeper(): void {
  if (sweepInterval) return;
  sweepInterval = setInterval(() => {
    try {
      const removed = sweepExpired();
      if (removed) log.info('Expired temporary chat attachments swept', { removed });
    } catch (error) {
      log.warn('Attachment sweeper failed', { message: (error as Error).message });
    }
  }, 10 * 60 * 1000);
  sweepInterval.unref?.();
}

/**
 * Stores an uploaded file in memory and returns its public metadata.
 * Validates size and MIME type; rejects unknown payloads.
 */
export function storeChatAttachment(input: {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
  userId: string;
}): ChatAttachmentMeta {
  ensureSweeper();

  if (input.buffer.length > CHAT_ATTACHMENT_LIMITS.maxSizeBytes) {
    const error = new Error('File too large. Please upload a file smaller than 10 MB.') as Error & { statusCode?: number };
    error.statusCode = 413;
    throw error;
  }

  const type = detectType(input.mimeType);
  if (!type) {
    const error = new Error('Only images (.jpg, .jpeg, .png, .webp) and PDF documents are supported.') as Error & { statusCode?: number };
    error.statusCode = 415;
    throw error;
  }

  const id = crypto.randomBytes(24).toString('hex');
  const name = sanitizeFileName(input.originalName);

  store.set(id, {
    id,
    userId: input.userId,
    name,
    type,
    mimeType: input.mimeType,
    size: input.buffer.length,
    buffer: input.buffer,
    createdAt: Date.now(),
  });

  return {
    id,
    name,
    type,
    mimeType: input.mimeType,
    size: input.buffer.length,
    createdAt: Date.now(),
  };
}

/** Reads attachments without removing them (usable by regenerate). */
export function readChatAttachments(
  ids: string[],
  userId: string
): StoredAttachment[] {
  const found: StoredAttachment[] = [];
  for (const id of ids) {
    const item = store.get(id);
    if (item && item.userId === userId) found.push(item);
  }
  return found;
}

/** Removes attachments (and their memory) once they are no longer needed. */
export function deleteChatAttachments(ids: string[], userId: string): void {
  for (const id of ids) {
    const item = store.get(id);
    if (item && item.userId === userId) store.delete(id);
  }
}

/** Count of attachments a user currently holds (upload limiter). */
export function countUserAttachments(userId: string): number {
  let count = 0;
  for (const item of store.values()) {
    if (item.userId === userId) count += 1;
  }
  return count;
}

/** Removes all in-memory attachments (used by tests / maintenance). */
export function clearChatAttachments(): void {
  store.clear();
}
