import { noticeRepository, chunkRepository } from '../repositories/notice.repository';
import {
  buildPreview,
  computeKeywordScore,
  escapeRegex,
  normalizeForSearch,
  normalizeText,
} from '../utils/text.utils';
import { safeObjectId } from '../config/gridfs';

/**
 * Keyword / text-index search over uploaded notices.
 * Behavior ported 1:1 from the legacy monolith so old responses
 * stay byte-compatible.
 */
export interface SearchResultItem {
  _id: unknown;
  title: string;
  category: string;
  type: string;
  fileId: unknown;
  mimeType: string;
  preview: string;
  summary: string;
  matchedChunk: string | null;
  relevanceScore: number;
  searchMode: string;
  createdAt: Date;
  hasFullText: boolean;
  fileUrl: string | null;
  fullNoticeUrl: string;
}

async function keywordSearchDocuments(
  query: string,
  category: string,
  limit: number
): Promise<Array<Record<string, unknown>>> {
  const cleanQuery = normalizeText(query);
  if (!cleanQuery) return [];

  const regex = new RegExp(escapeRegex(cleanQuery), 'i');
  const filter = category ? { category } : {};
  const results: Array<Record<string, unknown>> = [];

  // Text index search (best effort - index may be building)
  try {
    const textFilter = { ...filter, $text: { $search: cleanQuery } };
    const textResults = (await noticeRepository.rawFind(
      textFilter,
      {
        title: 1, category: 1, type: 1, fileId: 1, mimeType: 1, rawText: 1,
        summary: 1, createdAt: 1, score: { $meta: 'textScore' },
      },
      limit * 2
    )) as Array<Record<string, unknown> & { score?: number }>;

    for (const doc of textResults) {
      results.push({
        ...doc,
        searchMode: 'keyword-text',
        relevanceScore: (doc.score || 0) * 10 + 20,
        preview: (doc.summary as string) || buildPreview(doc.rawText || ''),
      });
    }
  } catch {
    // text index may not be ready - fall through to regex search
  }

  // Regex fallback (matches legacy behavior exactly)
  const regexResults = (await noticeRepository.rawRegexFind(
    {
      ...filter,
      $or: [{ title: regex }, { rawText: regex }, { normalizedText: regex }],
    },
    {
      title: 1, category: 1, type: 1, fileId: 1, mimeType: 1, rawText: 1,
      summary: 1, createdAt: 1,
    },
    limit * 2
  )) as Array<Record<string, unknown>>;

  for (const doc of regexResults) {
    const titleScore = computeKeywordScore(doc.title || '', cleanQuery) * 1.6;
    const textScore = computeKeywordScore(String(doc.rawText || '').slice(0, 4000), cleanQuery);
    results.push({
      ...doc,
      searchMode: 'keyword-regex',
      relevanceScore: titleScore + textScore + 25,
      preview: (doc.summary as string) || buildPreview(doc.rawText || ''),
    });
  }

  // Dedupe keeping highest score
  const deduped = new Map<string, Record<string, unknown>>();
  for (const item of results) {
    const key = String(item._id);
    const previous = deduped.get(key);
    if (!previous || (item.relevanceScore as number) > (previous.relevanceScore as number)) {
      deduped.set(key, item);
    }
  }

  return Array.from(deduped.values())
    .sort((a, b) => (b.relevanceScore as number) - (a.relevanceScore as number))
    .slice(0, limit);
}

async function searchChunks(
  query: string,
  category: string,
  limit: number
): Promise<Array<Record<string, unknown>>> {
  const cleanQuery = normalizeText(query);
  if (!cleanQuery) return [];

  const regex = new RegExp(escapeRegex(cleanQuery), 'i');
  const filter = category ? { category } : {};

  const chunks = (await chunkRepository.rawRegexFind(
    {
      ...filter,
      $or: [{ title: regex }, { chunkText: regex }, { normalizedChunkText: regex }],
    },
    {
      documentId: 1, title: 1, category: 1, chunkIndex: 1, chunkText: 1, preview: 1,
    },
    limit * 3
  )) as Array<Record<string, unknown>>;

  return chunks
    .map((chunk) => ({
      ...chunk,
      relevanceScore:
        computeKeywordScore(chunk.title || '', cleanQuery) * 1.5 +
        computeKeywordScore(chunk.chunkText || '', cleanQuery) +
        10,
    }))
    .sort((a, b) => (b.relevanceScore as number) - (a.relevanceScore as number))
    .slice(0, limit);
}

/** Merges document + chunk matches into ranked notice results. */
export async function searchNotices(
  query: string,
  category: string,
  limit = 10
): Promise<SearchResultItem[]> {
  const docs = await keywordSearchDocuments(query, category, limit);
  const chunks = await searchChunks(query, category, limit);

  const docMap = new Map<string, SearchResultItem>();

  for (const doc of docs) {
    docMap.set(String(doc._id), {
      _id: doc._id,
      title: (doc.title as string) || '',
      category: (doc.category as string) || 'general',
      type: (doc.type as string) || 'text',
      fileId: doc.fileId ?? null,
      mimeType: (doc.mimeType as string) || 'text/plain',
      preview: (doc.preview as string) || buildPreview(doc.rawText || ''),
      summary: (doc.summary as string) || buildPreview(doc.rawText || ''),
      matchedChunk: null,
      relevanceScore: (doc.relevanceScore as number) || 0,
      searchMode: (doc.searchMode as string) || 'keyword',
      createdAt: doc.createdAt as Date,
      hasFullText: Boolean(doc.rawText),
      fileUrl: doc.fileId ? `/api/files/${doc.fileId}` : null,
      fullNoticeUrl: `/api/student/notices/${doc._id}/full`,
    });
  }

  // Batch-load notice docs for chunks that didn't match at the doc level
  // (avoids an N+1 findById per chunk).
  const missingDocIds = chunks
    .map((chunk) => String(chunk.documentId ?? ''))
    .filter((docId) => docId && !docMap.has(docId))
    .map((docId) => safeObjectId(docId))
    .filter((id): id is Exclude<ReturnType<typeof safeObjectId>, null> => Boolean(id));

  const missingDocMap = new Map<string, Record<string, unknown>>();
  if (missingDocIds.length) {
    const notices = await noticeRepository.findByIdsFull(missingDocIds);
    for (const notice of notices) {
      missingDocMap.set(String(notice._id), notice);
    }
  }

  for (const chunk of chunks) {
    const docId = String(chunk.documentId);
    const existing = docMap.get(docId);

    if (existing) {
      existing.relevanceScore += Math.round(((chunk.relevanceScore as number) || 0) * 0.5);
      if (!existing.matchedChunk) {
        existing.matchedChunk = (chunk.chunkText as string) || null;
        existing.preview = (chunk.preview as string) || existing.preview;
      }
    } else {
      const doc = missingDocMap.get(docId);
      if (doc) {
        docMap.set(docId, {
          _id: doc._id,
          title: (doc.title as string) || '',
          category: (doc.category as string) || 'general',
          type: (doc.type as string) || 'text',
          fileId: doc.fileId ?? null,
          mimeType: (doc.mimeType as string) || 'text/plain',
          preview: (chunk.preview as string) || (doc.summary as string) || buildPreview(doc.rawText || ''),
          summary: (doc.summary as string) || buildPreview(doc.rawText || ''),
          matchedChunk: (chunk.chunkText as string) || null,
          relevanceScore: (chunk.relevanceScore as number) || 0,
          searchMode: 'chunk-match',
          createdAt: doc.createdAt as Date,
          hasFullText: Boolean(doc.rawText),
          fileUrl: doc.fileId ? `/api/files/${doc.fileId}` : null,
          fullNoticeUrl: `/api/student/notices/${doc._id}/full`,
        });
      }
    }
  }

  return Array.from(docMap.values())
    .sort((a, b) => b.relevanceScore - a.relevanceScore)
    .slice(0, limit);
}

/** Fetches the highest-scoring context chunks for a question. */
export async function getTopContextChunks(
  searchResults: SearchResultItem[],
  question: string,
  maxChunks = 8
): Promise<Array<Record<string, unknown>>> {
  const docIds = searchResults
    .slice(0, 5)
    .map((item) => safeObjectId(String(item._id)))
    .filter(Boolean) as ReturnType<typeof safeObjectId>[];

  if (!docIds.length) return [];

  const chunks = await chunkRepository.findByDocumentIds(docIds);

  const scored = chunks.map((chunk) => ({
    ...chunk,
    score:
      computeKeywordScore(chunk.title || '', question) * 1.5 +
      computeKeywordScore(chunk.chunkText || '', question) +
      (chunk.chunkIndex === 0 ? 5 : 0),
  }));

  return scored
    .sort((a, b) => ((b.score as number) || 0) - ((a.score as number) || 0))
    .slice(0, maxChunks) as unknown as Array<Record<string, unknown>>;
}

/**
 * Fetches notice file metadata for chunks so citations can link
 * the source file (PDF/image) and the full notice page.
 */
export async function attachNoticeMeta(
  chunks: Array<Record<string, unknown>>
): Promise<Map<string, Record<string, unknown>>> {
  const docIds = chunks
    .map((chunk) => safeObjectId(String(chunk.documentId ?? '')))
    .filter((id): id is Exclude<ReturnType<typeof safeObjectId>, null> => Boolean(id));

  if (!docIds.length) return new Map();

  const notices = await noticeRepository.findByIds(docIds);

  return new Map(notices.map((notice) => [String(notice._id), notice]));
}

export async function buildCitationsFromChunks(
  chunks: Array<Record<string, unknown>>
): Promise<Array<Record<string, unknown>>> {
  const top = chunks.slice(0, 4);
  const noticeMeta = await attachNoticeMeta(top);

  return top.map((chunk, index) => {
    const notice = noticeMeta.get(String(chunk.documentId ?? '')) || {};
    const fileId = notice.fileId ?? null;
    return {
      id: index + 1,
      sourceNumber: index + 1,
      title: chunk.title,
      category: chunk.category,
      excerpt: buildPreview(chunk.chunkText || '', 220),
      chunkIndex: chunk.chunkIndex,
      noticeId: chunk.documentId ?? null,
      fileId,
      fileUrl: fileId ? `/api/files/${String(fileId)}` : null,
      fullNoticeUrl: notice._id ? `/api/student/notices/${String(notice._id)}/full` : null,
      mimeType: notice.mimeType ?? null,
    };
  });
}

export function buildSourcesFromResults(results: SearchResultItem[]) {
  return results.slice(0, 3).map((item) => ({
    noticeId: item._id,
    title: item.title,
    category: item.category,
    fileUrl: item.fileUrl,
    fullNoticeUrl: item.fullNoticeUrl,
  }));
}

export function getFullNoticePayload(doc: {
  _id: unknown;
  title: string;
  category: string;
  type: string;
  mimeType: string;
  summary: string;
  rawText: string;
  fileId?: unknown;
  originalFileName?: string | null;
  createdAt: Date;
  updatedAt: Date;
}) {
  return {
    _id: doc._id,
    title: doc.title,
    category: doc.category,
    type: doc.type,
    mimeType: doc.mimeType,
    summary: doc.summary,
    fullText: doc.rawText,
    fileId: doc.fileId ?? null,
    fileUrl: doc.fileId ? `/api/files/${doc.fileId}` : null,
    originalFileName: doc.originalFileName || null,
    createdAt: doc.createdAt,
    updatedAt: doc.updatedAt,
  };
}

export function normalizeForSearchText(text: unknown): string {
  return normalizeForSearch(text);
}
