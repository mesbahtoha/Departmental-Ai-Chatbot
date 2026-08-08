import OpenRouterClient, { ChatMessageInput } from './openrouter.client';
import { searchNotices, getTopContextChunks, buildCitationsFromChunks, attachNoticeMeta, SearchResultItem } from './search.service';
import { ChatLogModel } from '../database/models/ChatLog.model';
import { PromptTemplateModel } from '../database/models/PromptTemplate.model';
import { settingsService } from './settings.service';
import { createTtlCache } from '../utils/cache';
import {
  buildPreview,
  detectLanguage,
  isNoticeRelatedQuery,
  normalizeText,
  safeJsonParse,
} from '../utils/text.utils';
import { log } from '../config/logger';

interface ActiveTemplate {
  content: string;
  isDefault?: boolean;
}

// Prompt templates change rarely; cache them briefly so chat requests
// skip a MongoDB query on every message. Invalidate on admin CRUD.
const templateCache = createTtlCache<ActiveTemplate[]>(30_000);

/** Invalidates the cached prompt templates (call after admin CRUD). */
export function clearPromptTemplateCache(): void {
  templateCache.clear();
}

async function getActiveTemplates(): Promise<ActiveTemplate[]> {
  const cached = templateCache.get('active');
  if (cached) return cached;

  const templates = (await PromptTemplateModel.find({ isActive: true })
    .sort({ isDefault: -1 })
    .select('content isDefault')
    .lean()) as unknown as ActiveTemplate[];

  templateCache.set('active', templates);
  return templates;
}

interface ContextAnswer {
  answer: string;
  confidence: 'high' | 'medium' | 'low';
  citations: Array<Record<string, unknown>>;
}

/** Legacy conversation memory pulled from chatLogs (behavior preserved). */
async function getConversationMemory(userId: string | null, limit = 4): Promise<Array<Record<string, unknown>>> {
  if (!userId) return [];

  return ChatLogModel.find({
    userId,
    mode: { $in: ['answer', 'full_notice', 'summary'] },
  })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean() as unknown as Promise<Array<Record<string, unknown>>>;
}

function buildConversationMemoryText(memory: Array<Record<string, unknown>>): string {
  if (!memory.length) return '';

  return memory
    .reverse()
    .map((item, index) => {
      const sources = (item.sources as Array<{ title?: string }>)
        ?.map((s) => s.title)
        .filter(Boolean)
        .join(', ');

      return [
        `Conversation item ${index + 1}:`,
        `User asked: ${item.query || ''}`,
        `Assistant answered: ${item.answer || ''}`,
        sources ? `Related notices: ${sources}` : '',
      ]
        .filter(Boolean)
        .join('\n');
    })
    .join('\n\n-----------------\n\n');
}

function makeFallbackAnswer({
  searchResults,
  contextChunks,
  language,
}: {
  searchResults: SearchResultItem[];
  contextChunks: Array<Record<string, unknown>>;
  language: 'bn' | 'en';
}): Promise<ContextAnswer> {
  const best = searchResults[0];
  const bestChunk = contextChunks[0];

  if (!best) {
    return Promise.resolve({
      answer:
        language === 'bn'
          ? 'আমি আপলোড করা নোটিশগুলোর মধ্যে মিলযুক্ত তথ্য খুঁজে পাইনি।'
          : 'I could not find a matching answer in the uploaded notices.',
      confidence: 'low',
      citations: [],
    });
  }

  const answer =
    language === 'bn'
      ? `আমি সবচেয়ে কাছের নোটিশ হিসেবে "${best.title}" পেয়েছি। ${
          bestChunk?.chunkText
            ? buildPreview(bestChunk.chunkText, 260)
            : 'প্রাসঙ্গিক তথ্য পাওয়া গেছে, তবে সুনির্দিষ্ট উত্তরের জন্য পুরো নোটিশ খুলে দেখুন।'
        }`
      : `I found the closest notice as "${best.title}". ${
          bestChunk?.chunkText
            ? buildPreview(bestChunk.chunkText, 260)
            : 'Relevant information exists, but for a precise answer please open the full notice.'
        }`;

  return buildCitationsFromChunks(contextChunks).then((citations) => ({
    answer,
    confidence: 'medium',
    citations,
  }));
}

/** Builds a per-request language instruction for the model. */
function buildLanguageInstruction(language?: string): string {
  switch (language) {
    case 'en':
      return 'Language: Reply in English only.';
    case 'bn':
      return 'Language: Reply in Bengali (Bangla) only, using Bengali script.';
    case 'banglish':
      return 'Language: Reply in Banglish - Bengali written with English (Latin) letters exactly like a Bengali speaker typing on a phone (e.g. "ami aj exam debo"). Keep Bengali phrases and natural Banglish style.';
    default:
      return 'Language: Match the language the user is writing in - reply in Bengali (Bangla script) if they write in Bengali, reply in Banglish (Bengali written in Latin letters) if they write in Banglish, otherwise reply in English. Never switch to a different language than the user used.';
  }
}

/**
 * AI service.
 * 1. answerFromContext - legacy RAG answer (JSON response, ported 1:1).
 * 2. buildChatMessages - builds the message array for the v1 streaming chat,
 *    including active prompt templates + RAG context when relevant.
 */
export const aiService = {
  /** Answers a question strictly from uploaded notices (legacy contract). */
  async answerFromContext(
    question: string,
    searchResults: SearchResultItem[],
    userId: string | null
  ): Promise<ContextAnswer> {
    const language = detectLanguage(question);
    const contextChunks = await getTopContextChunks(searchResults, question, 8);
    const memory = await getConversationMemory(userId, 4);
    const memoryText = buildConversationMemoryText(memory);

    const contextBlocks = contextChunks.map(
      (chunk, idx) =>
        `Source ${idx + 1}
Title: ${chunk.title}
Category: ${chunk.category}
Chunk Index: ${chunk.chunkIndex}
Content:
${chunk.chunkText}`
    );

    const combinedContext = contextBlocks.join('\n\n====================\n\n');

    if (!combinedContext.trim()) {
      return makeFallbackAnswer({ searchResults, contextChunks, language });
    }

    const systemPrompt = `
You are a university department notice assistant.

Your job:
- Answer ONLY from the provided notice context.
- Be accurate, grounded, and helpful.
- Understand natural language questions like a real chatbot, but never invent facts.
- If the exact answer is not present, say so clearly.
- Use the same language as the user's question.
- If the user writes in Banglish (Bengali written in English letters), answer in Banglish.
- Prefer the most specific date, deadline, time, exam, routine, admission, result, scholarship, or official instruction found in the sources.
- If multiple notices conflict, prefer the most relevant source to the question and mention uncertainty briefly.
- Keep answers concise but complete.
- Return JSON only in this shape:
{
  "answer": "final answer",
  "confidence": "high|medium|low",
  "citations": [
    {
      "sourceNumber": 1,
      "reason": "why this source supports the answer"
    }
  ]
}
Do not include markdown fences.
`.trim();

    const userPrompt = `
User question:
${question}

Recent conversation memory:
${memoryText || 'No previous conversation memory.'}

Available notice context:
${combinedContext}
`.trim();

    try {
      const { text: raw } = await OpenRouterClient.complete(
        [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt },
        ],
        {
          temperature: 0.1,
          maxTokens: 500,
          responseFormat: { type: 'json_object' },
        }
      );

      const parsed = safeJsonParse<{
        answer?: string;
        confidence?: string;
        citations?: Array<{ sourceNumber?: number; reason?: string }>;
      }>(raw);

      if (!parsed || typeof parsed !== 'object') {
        return makeFallbackAnswer({ searchResults, contextChunks, language });
      }

      let citations: Array<Record<string, unknown>> = [];
      if (Array.isArray(parsed.citations)) {
        const noticeMeta = await attachNoticeMeta(contextChunks);
        citations = parsed.citations
          .map((item) => {
            const sourceNumber = Number(item?.sourceNumber);
            if (!sourceNumber || !contextChunks[sourceNumber - 1]) return null;
            const chunk = contextChunks[sourceNumber - 1];
            const notice = noticeMeta.get(String(chunk.documentId ?? '')) || {};
            const fileId = notice.fileId ?? null;
            return {
              sourceNumber,
              title: chunk.title,
              category: chunk.category,
              excerpt: buildPreview(chunk.chunkText || '', 220),
              chunkIndex: chunk.chunkIndex,
              reason: normalizeText(item?.reason || ''),
              noticeId: chunk.documentId ?? null,
              fileId,
              fileUrl: fileId ? `/api/files/${String(fileId)}` : null,
              fullNoticeUrl: notice._id
                ? `/api/student/notices/${String(notice._id)}/full`
                : null,
              mimeType: notice.mimeType ?? null,
            } as Record<string, unknown>;
          })
          .filter((item): item is Record<string, unknown> => item !== null);
      }

      return {
        answer:
          normalizeText(parsed.answer || '') || 'I could not generate an answer.',
        confidence: ['high', 'medium', 'low'].includes(parsed.confidence || '')
          ? (parsed.confidence as ContextAnswer['confidence'])
          : 'medium',
        citations,
      };
    } catch (error) {
      log.warn('answerFromContext failed, using fallback', {
        message: (error as Error).message,
      });
      return makeFallbackAnswer({ searchResults, contextChunks, language });
    }
  },

  /**
   * Builds the message array for the v1 streaming chat:
   * - active prompt templates + configured system prompt
   * - optional notice RAG context when the search finds matches
   * - recent conversation history
   */
  async buildChatMessages(input: {
    userContent: string;
    history: Array<{ role: 'user' | 'assistant'; content: string }>;
    includeRagContext?: boolean;
    language?: string;
  }): Promise<{ messages: ChatMessageInput[]; context?: { searchResults: SearchResultItem[]; citations: Array<Record<string, unknown>> } }> {
    const aiSettings = await settingsService.getAISettings();

    const templates = await getActiveTemplates();

    const systemParts: string[] = [];

    if (aiSettings.systemPrompt) {
      systemParts.push(aiSettings.systemPrompt);
    }

    for (const template of templates) {
      systemParts.push(template.content);
    }

    systemParts.push(buildLanguageInstruction(input.language));

    if (!systemParts.length) {
      systemParts.push(
        'You are a helpful, accurate, and friendly AI assistant. Answer clearly, prefer concise but complete responses, and be honest when you do not know something.'
      );
    }

    // RAG context: only surface notice sources when the question is actually
    // about notices (exams, routines, fees, scholarships, etc.).
    let ragBlock = '';
    let citations: Array<Record<string, unknown>> = [];
    let searchResults: SearchResultItem[] = [];

    if (input.includeRagContext !== false && isNoticeRelatedQuery(input.userContent)) {
      searchResults = await searchNotices(input.userContent, '', 5);
      if (searchResults.length) {
        const contextChunks = await getTopContextChunks(searchResults, input.userContent, 8);
        const blocks = contextChunks.map(
          (chunk, idx) =>
            `Source ${idx + 1}\nTitle: ${chunk.title}\nCategory: ${chunk.category}\nContent:\n${chunk.chunkText}`
        );
        ragBlock = blocks.join('\n\n====================\n\n');
        citations = await buildCitationsFromChunks(contextChunks);
      }
    }

    const messages: ChatMessageInput[] = [];

    if (ragBlock) {
      systemParts.push(
        'Relevant uploaded notices are available in the "Notice context" section of the user message. Answer using them when the user asks about notices, routines, exams, results, admission, or scholarships. Cite sources like [Source 1] when you use them.'
      );
    }

    messages.push({ role: 'system', content: systemParts.join('\n\n').trim() });

    for (const item of input.history) {
      messages.push({ role: item.role === 'assistant' ? 'assistant' : 'user', content: item.content });
    }

    const userParts: string[] = [input.userContent];

    if (ragBlock) {
      userParts.push(`\n\nNotice context:\n${ragBlock}`);
    }

    messages.push({ role: 'user', content: userParts.join('\n') });

    return { messages, context: { searchResults, citations } };
  },
};

export default aiService;
