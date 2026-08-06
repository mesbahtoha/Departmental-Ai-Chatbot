import { Request, Response } from 'express';
import { asyncHandler, fail, ok } from '../../../utils/response.utils';
import conversationService from './conversation.service';
import { parsePagination } from '../../../utils/helpers';

export const conversationController = {
  list: asyncHandler(async (req: Request, res: Response) => {
    const pagination = parsePagination(req.query, 30, 100);
    const { search } = req.query as { search?: string };

    const { items, total } = await conversationService.listForUser(req.user!.id, {
      search,
      page: pagination.page,
      limit: pagination.limit,
    });

    ok(res, { conversations: items, total, page: pagination.page, limit: pagination.limit });
  }),

  create: asyncHandler(async (req: Request, res: Response) => {
    const conversation = await conversationService.create(req.user!.id, req.body.title);
    ok(res, { conversation }, 201);
  }),

  getById: asyncHandler(async (req: Request, res: Response) => {
    const { limit = 200 } = req.query as { limit?: number };
    const data = await conversationService.getWithMessages(req.params.id, req.user!.id, {
      limit: Math.min(Number(limit) || 200, 500),
    });

    if (!data) return fail(res, 404, 'Conversation not found');
    ok(res, data);
  }),

  update: asyncHandler(async (req: Request, res: Response) => {
    const conversation = await conversationService.update(
      req.params.id,
      req.user!.id,
      req.body
    );

    if (!conversation) return fail(res, 404, 'Conversation not found');
    ok(res, { conversation });
  }),

  remove: asyncHandler(async (req: Request, res: Response) => {
    const deleted = await conversationService.delete(req.params.id, req.user!.id);
    if (!deleted) return fail(res, 404, 'Conversation not found');
    ok(res, { message: 'Conversation deleted' });
  }),

  clearAll: asyncHandler(async (req: Request, res: Response) => {
    const deleted = await conversationService.clearAll(req.user!.id);
    ok(res, { message: 'All conversations cleared', deleted });
  }),

  exportChat: asyncHandler(async (req: Request, res: Response) => {
    const format = req.query.format === 'markdown' ? 'markdown' : 'json';
    const data = await conversationService.exportChat(req.params.id, req.user!.id, format);
    if (!data) return fail(res, 404, 'Conversation not found');

    const fileName = `chat-${req.params.id.slice(-8)}.${format === 'markdown' ? 'md' : 'json'}`;
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Type', format === 'markdown' ? 'text/markdown' : 'application/json');
    res.send(data.content);
  }),

  toggleShare: asyncHandler(async (req: Request, res: Response) => {
    const { enabled } = req.body as { enabled?: boolean };
    const result = await conversationService.toggleShare(req.params.id, req.user!.id, Boolean(enabled));
    if (!result) return fail(res, 404, 'Conversation not found');
    ok(res, result);
  }),

  /** Public share page data - no auth. */
  shared: asyncHandler(async (req: Request, res: Response) => {
    const data = await conversationService.getShared(req.params.token);
    if (!data) return fail(res, 404, 'Shared conversation not found');
    ok(res, { chat: data });
  }),
};

export default conversationController;
