import { Request, Response } from 'express';
import { asyncHandler, fail, ok } from '../../../utils/response.utils';
import adminService from './admin.service';
import noticeService from '../../../services/notice.service';
import { noticeRepository } from '../../../repositories/notice.repository';
import { PromptTemplateModel } from '../../../database/models/PromptTemplate.model';
import { maskSecret } from '../../../utils/token.utils';
import env from '../../../config/env';

export const adminController = {
  /** Dashboard summary stats. */
  dashboard: asyncHandler(async (req: Request, res: Response) => {
    const stats = await adminService.dashboard();
    ok(res, { stats });
  }),

  // ---------- Users ----------
  listUsers: asyncHandler(async (req: Request, res: Response) => {
    const { search } = req.query as { search?: string };
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const data = await adminService.listUsers(search || '', page, limit);
    ok(res, data);
  }),

  updateUser: asyncHandler(async (req: Request, res: Response) => {
    const user = await adminService.updateUser(req.params.id, req.body);
    if (!user) return fail(res, 404, 'User not found');
    ok(res, {
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        lastLoginAt: user.lastLoginAt,
      },
    });
  }),

  deleteUser: asyncHandler(async (req: Request, res: Response) => {
    const deleted = await adminService.deleteUser(req.params.id);
    if (!deleted) return fail(res, 404, 'User not found');
    ok(res, { message: 'User deleted' });
  }),

  // ---------- Notices ----------
  listNotices: asyncHandler(async (req: Request, res: Response) => {
    const category = (req.query.category as string) || '';
    const filter = category ? { category } : {};
    const notices = await noticeRepository.list(filter, 200);

    ok(res, {
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
    ok(res, { notice: noticeService.getPayload(notice) });
  }),

  createNotice: asyncHandler(async (req: Request, res: Response) => {
    const title = String(req.body.title || req.body.headline || '');
    const category = String(req.body.category || 'general') || 'general';
    const textContent = String(req.body.textContent || req.body.noticeText || req.body.content || '');
    const uploadedBy = String(req.body.uploadedBy || 'admin');

    if (!title) return fail(res, 400, 'title or headline is required');
    if (!req.file && !textContent.trim()) {
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
    ok(res, { notice });
  }),

  reindexNotice: asyncHandler(async (req: Request, res: Response) => {
    const doc = await noticeRepository.findById(req.params.id);
    if (!doc) return fail(res, 404, 'Notice not found');

    const chunkCount = await noticeService.rebuildChunksForDocument(doc);
    await noticeRepository.update(doc._id, { chunkCount, status: 'ready' });

    ok(res, { message: 'Reindex completed', chunkCount });
  }),

  deleteNotice: asyncHandler(async (req: Request, res: Response) => {
    await noticeService.deleteNoticeAndFile(req.params.id);
    ok(res, { message: 'Notice deleted successfully' });
  }),

  // ---------- Chat history ----------
  chatHistory: asyncHandler(async (req: Request, res: Response) => {
    const { search } = req.query as { search?: string };
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 20), 100);
    const data = await adminService.chatHistory(search || '', page, limit);
    ok(res, data);
  }),

  // ---------- Analytics ----------
  analytics: asyncHandler(async (req: Request, res: Response) => {
    const from = (req.query.from as string) || undefined;
    const to = (req.query.to as string) || undefined;
    const groupBy = req.query.groupBy === 'month' ? 'month' : 'day';
    const data = await adminService.usageAnalytics(from, to, groupBy);
    ok(res, { analytics: data });
  }),

  // ---------- Token usage ----------
  tokenOverview: asyncHandler(async (req: Request, res: Response) => {
    const data = await adminService.tokenOverview();
    ok(res, { tokens: data });
  }),

  // ---------- Settings ----------
  getSettings: asyncHandler(async (req: Request, res: Response) => {
    const settings = await adminService.getSettings();
    ok(res, { settings });
  }),

  updateSettings: asyncHandler(async (req: Request, res: Response) => {
    const settings = await adminService.updateSettings(req.body.entries);
    ok(res, { settings });
  }),

  /** Masks the stored OpenRouter key so secrets are never leaked. */
  getApiKeyStatus: asyncHandler(async (req: Request, res: Response) => {
    const key = env.openRouter.apiKey;
    ok(res, {
      configured: Boolean(key),
      masked: key ? maskSecret(key) : null,
      source: key ? 'env' : 'none',
    });
  }),

  // ---------- Prompt templates ----------
  listTemplates: asyncHandler(async (req: Request, res: Response) => {
    const templates = await PromptTemplateModel.find().sort({ isDefault: -1, createdAt: 1 });
    ok(res, { templates });
  }),

  createTemplate: asyncHandler(async (req: Request, res: Response) => {
    const existing = await PromptTemplateModel.findOne({ key: req.body.key });
    if (existing) return fail(res, 409, 'A template with this key already exists');

    const template = await PromptTemplateModel.create(req.body);
    res.status(201).json({ success: true, template });
  }),

  updateTemplate: asyncHandler(async (req: Request, res: Response) => {
    const template = await PromptTemplateModel.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!template) return fail(res, 404, 'Template not found');
    ok(res, { template });
  }),

  deleteTemplate: asyncHandler(async (req: Request, res: Response) => {
    const template = await PromptTemplateModel.findByIdAndDelete(req.params.id);
    if (!template) return fail(res, 404, 'Template not found');
    ok(res, { message: 'Template deleted' });
  }),

  // ---------- Logs ----------
  listLogs: asyncHandler(async (req: Request, res: Response) => {
    const { level } = req.query as { level?: string };
    const page = Number(req.query.page || 1);
    const limit = Math.min(Number(req.query.limit || 50), 200);
    const data = await adminService.listLogs(level, page, limit);
    ok(res, data);
  }),

  // ---------- System monitoring ----------
  systemInfo: asyncHandler(async (req: Request, res: Response) => {
    const system = await adminService.systemInfo();
    ok(res, { system });
  }),
};

export default adminController;
