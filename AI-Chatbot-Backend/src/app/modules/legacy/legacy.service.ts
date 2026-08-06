import { ChatLogModel, FeedbackModel } from '../../../database/models';
import { SearchResultItem, searchNotices, buildSourcesFromResults } from '../../../services/search.service';
import { aiService } from '../../../services/ai.service';
import { noticeService } from '../../../services/notice.service';
import { noticeRepository } from '../../../repositories/notice.repository';
import { detectLanguage, isFullNoticeIntent, isGreetingIntent, isSummaryIntent, normalizeText } from '../../../utils/text.utils';

/**
 * Legacy chat service - preserves the exact behavior of the original
 * /api/student/query and /api/ai/ask endpoints (greeting / no-result /
 * full-notice / summary / answer intents + chatLogs persistence).
 */
export const legacyChatService = {
  async handleQuery(input: {
    query: string;
    category: string;
    userId: string | null;
  }): Promise<Record<string, unknown>> {
    const query = normalizeText(input.query);
    const userId = input.userId || null;

    // Greeting intent
    if (isGreetingIntent(query)) {
      const greeting =
        detectLanguage(query) === 'bn'
          ? 'হ্যালো। আপনি নোটিশ, রুটিন, পরীক্ষা, ফলাফল, ভর্তি, বা স্কলারশিপ সম্পর্কে প্রশ্ন করতে পারেন।'
          : 'Hello. You can ask me about notices, routines, exams, results, admission, or scholarship information.';

      const chatLog = await ChatLogModel.create({
        userId,
        query,
        answer: greeting,
        sources: [],
        citations: [],
        confidence: 'high',
        mode: 'greeting',
      });

      return {
        success: true,
        mode: 'greeting',
        answer: greeting,
        confidence: 'high',
        citations: [],
        sources: [],
        chatLogId: chatLog._id,
      };
    }

    const results = await searchNotices(query, input.category, 5);

    // No results
    if (!results.length) {
      const answer =
        detectLanguage(query) === 'bn'
          ? 'আমি আপলোড করা নোটিশগুলোর মধ্যে মিলযুক্ত তথ্য খুঁজে পাইনি।'
          : 'I could not find any matching notice in the uploaded documents.';

      const chatLog = await ChatLogModel.create({
        userId,
        query,
        answer,
        sources: [],
        citations: [],
        confidence: 'low',
        mode: 'no_result',
      });

      return {
        success: true,
        mode: 'no_result',
        answer,
        confidence: 'low',
        citations: [],
        sources: [],
        chatLogId: chatLog._id,
      };
    }

    // Full notice intent
    if (isFullNoticeIntent(query)) {
      const fullNotice = await this.getFullNotice(results[0]);

      const source = {
        noticeId: fullNotice._id,
        title: fullNotice.title,
        category: fullNotice.category,
        fileUrl: fullNotice.fileUrl,
        fullNoticeUrl: `/api/student/notices/${fullNotice._id}/full`,
      };

      const chatLog = await ChatLogModel.create({
        userId,
        query,
        answer: 'Full notice returned',
        sources: [source],
        citations: [],
        confidence: 'high',
        mode: 'full_notice',
      });

      return {
        success: true,
        mode: 'full_notice',
        notice: fullNotice,
        confidence: 'high',
        citations: [],
        sources: [source],
        chatLogId: chatLog._id,
      };
    }

    // Summary intent
    if (isSummaryIntent(query)) {
      const bestNotice = await this.getFullNotice(results[0]);
      const answer =
        bestNotice?.summary ||
        (detectLanguage(query) === 'bn'
          ? 'সারাংশ তৈরি করা যায়নি।'
          : 'Summary could not be generated.');

      const sources = buildSourcesFromResults(results);

      const chatLog = await ChatLogModel.create({
        userId,
        query,
        answer,
        sources,
        citations: [],
        confidence: 'high',
        mode: 'summary',
      });

      return {
        success: true,
        mode: 'summary',
        answer,
        confidence: 'high',
        citations: [],
        sources,
        matchedResults: results,
        chatLogId: chatLog._id,
      };
    }

    // Regular RAG answer
    const aiResult = await aiService.answerFromContext(query, results, userId);
    const sources = buildSourcesFromResults(results);

    const chatLog = await ChatLogModel.create({
      userId,
      query,
      answer: aiResult.answer,
      sources,
      citations: aiResult.citations || [],
      confidence: aiResult.confidence || 'medium',
      mode: 'answer',
    });

    return {
      success: true,
      mode: 'answer',
      answer: aiResult.answer,
      confidence: aiResult.confidence || 'medium',
      citations: aiResult.citations || [],
      sources,
      matchedResults: results,
      chatLogId: chatLog._id,
    };
  },

  async handleAsk(input: {
    question: string;
    category: string;
    userId: string | null;
  }): Promise<Record<string, unknown>> {
    const question = normalizeText(input.question);
    const userId = input.userId || null;

    // Greeting intent (same as handleQuery)
    if (isGreetingIntent(question)) {
      const greeting =
        detectLanguage(question) === 'bn'
          ? 'হ্যালো। আপনি নোটিশ, রুটিন, পরীক্ষা, ফলাফল, ভর্তি, বা স্কলারশিপ সম্পর্কে প্রশ্ন করতে পারেন।'
          : 'Hello. You can ask me about notices, routines, exams, results, admission, or scholarship information.';

      const chatLog = await ChatLogModel.create({
        userId,
        query: question,
        answer: greeting,
        sources: [],
        citations: [],
        confidence: 'high',
        mode: 'greeting',
      });

      return {
        success: true,
        answer: greeting,
        confidence: 'high',
        citations: [],
        sources: [],
        matchedResults: [],
        chatLogId: chatLog._id,
      };
    }

    const results = await searchNotices(question, input.category, 5);

    if (!results.length) {
      const answer =
        detectLanguage(question) === 'bn'
          ? 'আমি আপলোড করা নোটিশগুলোর মধ্যে মিলযুক্ত তথ্য খুঁজে পাইনি।'
          : 'I could not find any matching notice in the uploaded documents.';

      const chatLog = await ChatLogModel.create({
        userId,
        query: question,
        answer,
        sources: [],
        citations: [],
        confidence: 'low',
        mode: 'no_result',
      });

      return {
        success: true,
        answer,
        confidence: 'low',
        citations: [],
        sources: [],
        matchedResults: [],
        chatLogId: chatLog._id,
      };
    }

    const aiResult = await aiService.answerFromContext(question, results, userId);
    const sources = buildSourcesFromResults(results);

    const chatLog = await ChatLogModel.create({
      userId,
      query: question,
      answer: aiResult.answer,
      sources,
      citations: aiResult.citations || [],
      confidence: aiResult.confidence || 'medium',
      mode: 'answer',
    });

    return {
      success: true,
      answer: aiResult.answer,
      confidence: aiResult.confidence || 'medium',
      citations: aiResult.citations || [],
      sources,
      matchedResults: results,
      chatLogId: chatLog._id,
    };
  },

  async getFullNotice(result: SearchResultItem) {
    const doc = await noticeRepository.findById(result._id);
    if (!doc) {
      return {
        _id: result._id,
        title: result.title,
        category: result.category,
        type: result.type,
        mimeType: result.mimeType,
        summary: result.summary,
        fullText: result.matchedChunk || result.preview,
        fileId: result.fileId,
        fileUrl: result.fileUrl,
        originalFileName: null,
      };
    }
    return noticeService.getPayload(doc);
  },

  async saveFeedback(input: { chatLogId: unknown; type: string; comment: string }) {
    const result = await FeedbackModel.create({
      chatLogId: input.chatLogId,
      type: input.type,
      comment: input.comment,
    });
    return result._id;
  },
};

export default legacyChatService;
