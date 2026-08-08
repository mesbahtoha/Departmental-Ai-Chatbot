import { Request, Response } from 'express';
import { asyncHandler, fail, ok } from '../../../utils/response.utils';
import legacyChatService from './legacy.service';
import { searchNotices, getFullNoticePayload as buildPayload } from '../../../services/search.service';
import { noticeService } from '../../../services/notice.service';
import { noticeRepository } from '../../../repositories/notice.repository';
import { findFile, safeObjectId, streamFile } from '../../../config/gridfs';
import { UserModel } from '../../../database/models/User.model';
import { normalizeText } from '../../../utils/text.utils';
import { ChatLogModel } from '../../../database/models/ChatLog.model';
import env from '../../../config/env';
import { listRoutes } from './legacy.routes';

/**
 * Legacy controllers - preserve the exact response contracts of the
 * original single-file server so existing integrations keep working.
 */
export const legacyController = {
  home: (_req: Request, res: Response) => {
    res.send('🚀 Server is running...');
  },

  test: (_req: Request, res: Response) => {
    res.json({
      success: true,
      message: 'API test ok',
      file: __filename,
      time: new Date().toISOString(),
    });
  },

  routes: (_req: Request, res: Response) => {
    res.json({
      success: true,
      routes: listRoutes(),
      file: __filename,
    });
  },

  listLegacyUsers: asyncHandler(async (_req: Request, res: Response) => {
    const users = await UserModel.find().sort({ createdAt: -1 }).lean();
    res.send(users);
  }),

  createLegacyUser: asyncHandler(async (req: Request, res: Response) => {
    const result = await UserModel.create({
      ...req.body,
      createdAt: new Date(),
    });
    res.send(result);
  }),

  listNotices: asyncHandler(async (req: Request, res: Response) => {
    const category = (req.query.category as string) || '';
    const filter = category ? { category } : {};
    const notices = await noticeRepository.list(filter, 200);

    res.json({
      success: true,
      notices: notices.map((n) => ({
        _id: n._id,
        title: n.title,
        category: n.category,
        type: n.type,
        mimeType: n.mimeType,
        originalFileName: n.originalFileName,
        fileId: n.fileId,
        summary: n.summary,
        status: n.status,
        chunkCount: n.chunkCount,
        createdAt: n.createdAt,
        updatedAt: n.updatedAt,
      })),
    });
  }),

  getNotice: asyncHandler(async (req: Request, res: Response) => {
    const notice = await noticeRepository.findById(req.params.id);
    if (!notice) return fail(res, 404, 'Notice not found');
    res.json({ success: true, notice: noticeService.getPayload(notice) });
  }),

  createNotice: asyncHandler(async (req: Request, res: Response) => {
    const title = normalizeText(req.body.title || req.body.headline || '');
    const category = normalizeText(req.body.category || 'general') || 'general';
    const textContent = req.body.textContent || req.body.noticeText || req.body.content || '';
    const uploadedBy = req.body.uploadedBy || 'admin';

    if (!title) return fail(res, 400, 'title or headline is required');
    if (!req.file && !normalizeText(textContent)) {
      return fail(res, 400, 'Provide either a file or textContent/noticeText/content');
    }

    const notice = await noticeService.createNotice({
      title,
      category,
      textContent,
      file: req.file || null,
      uploadedBy,
    });

    res.status(201).json({
      success: true,
      message: 'Notice uploaded and indexed successfully',
      notice,
    });
  }),

  updateNotice: asyncHandler(async (req: Request, res: Response) => {
    const notice = await noticeService.updateNotice(req.params.id, req.body);
    if (!notice) return fail(res, 404, 'Notice not found');
    res.json({ success: true, notice });
  }),

  reindexNotice: asyncHandler(async (req: Request, res: Response) => {
    const doc = await noticeRepository.findById(req.params.id);
    if (!doc) return fail(res, 404, 'Notice not found');

    const chunkCount = await noticeService.rebuildChunksForDocument(doc);
    await noticeRepository.update(doc._id, { chunkCount, status: 'ready' });

    res.json({ success: true, message: 'Reindex completed', chunkCount });
  }),

  deleteNotice: asyncHandler(async (req: Request, res: Response) => {
    await noticeService.deleteNoticeAndFile(req.params.id);
    res.json({ success: true, message: 'Notice deleted successfully' });
  }),

  streamFile: asyncHandler(async (req: Request, res: Response) => {
    const fileId = safeObjectId(req.params.fileId);
    if (!fileId) return fail(res, 400, 'Invalid file id');

    const fileDoc = await findFile(fileId);
    if (!fileDoc) return fail(res, 404, 'File not found');

    res.set('Content-Type', fileDoc.contentType || 'application/octet-stream');
    res.set('Content-Disposition', `inline; filename="${fileDoc.filename || 'file'}"`);

    await streamFile(res, fileId);
  }),

  studentSearch: asyncHandler(async (req: Request, res: Response) => {
    const query = String(req.query.query || '');
    const category = String(req.query.category || '');
    const limit = Math.min(Number(req.query.limit || 10), 20);

    if (!normalizeText(query)) {
      return fail(res, 400, 'query is required');
    }

    const results = await searchNotices(query, category, limit);

    res.json({
      success: true,
      total: results.length,
      results,
    });
  }),

  fullNotice: asyncHandler(async (req: Request, res: Response) => {
    const notice = await noticeRepository.findById(req.params.id);
    if (!notice) return fail(res, 404, 'Notice not found');

    res.json({
      success: true,
      mode: 'full_notice',
      notice: noticeService.getPayload(notice),
    });
  }),

  studentQuery: asyncHandler(async (req: Request, res: Response) => {
    const query = normalizeText(req.body.query || req.body.question || '');
    const category = normalizeText(req.body.category || '');
    const userId = req.body.userId || null;

    if (!query) return fail(res, 400, 'query/question is required');

    const payload = await legacyChatService.handleQuery({ query, category, userId });
    res.json(payload);
  }),

  aiAsk: asyncHandler(async (req: Request, res: Response) => {
    const question = normalizeText(req.body.question || '');
    const category = normalizeText(req.body.category || '');
    const userId = req.body.userId || null;

    if (!question) return fail(res, 400, 'question is required');

    const payload = await legacyChatService.handleAsk({ question, category, userId });
    res.json(payload);
  }),

  feedback: asyncHandler(async (req: Request, res: Response) => {
    const chatLogId = safeObjectId(req.body.chatLogId);
    const type = req.body.type;
    const comment = req.body.comment || '';

    if (!chatLogId || !type) {
      return fail(res, 400, 'chatLogId and type are required');
    }

    const insertedId = await legacyChatService.saveFeedback({ chatLogId, type, comment });
    res.json({ success: true, insertedId });
  }),
};

export default legacyController;
