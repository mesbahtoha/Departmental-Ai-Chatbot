import { Router, Request, Response } from 'express';
import { asyncHandler, fail, ok } from '../../../utils/response.utils';
import { authenticate } from '../../../middleware/auth.middleware';
import notificationService, { notificationBus } from '../../../services/notification.service';

const router = Router();

/**
 * Server-Sent Events stream. `EventSource` cannot send an Authorization
 * header, so the access token may also be supplied as `?token=`.
 */
router.get('/stream', (req: Request, res: Response) => {
  const queryToken = typeof req.query.token === 'string' ? req.query.token : '';
  if (queryToken && !req.headers.authorization) {
    req.headers.authorization = `Bearer ${queryToken}`;
  }
  void authenticate(req, res, () => {
    if (!req.user) return;
    res.status(200);
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache, no-transform');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no');
    res.flushHeaders?.();
    res.write(`retry: 5000\n\n`);
    res.write(`event: ready\ndata: ${JSON.stringify({ connected: true })}\n\n`);

    const channel = `user:${req.user!.id}`;
    const onNotification = (payload: unknown) => {
      res.write(`event: notification\ndata: ${JSON.stringify(payload)}\n\n`);
    };
    notificationBus.on(channel, onNotification);

    const heartbeat = setInterval(() => {
      res.write(`: keep-alive\n\n`);
    }, 25000);

    const cleanup = () => {
      clearInterval(heartbeat);
      notificationBus.off(channel, onNotification);
    };
    req.on('close', cleanup);
    req.on('aborted', cleanup);
  });
});

router.use(authenticate);

router.get(
  '/',
  asyncHandler(async (req: Request, res: Response) => {
    const unreadOnly = req.query.unreadOnly === 'true';
    const limit = Number(req.query.limit || 30);
    const data = await notificationService.list(req.user!.id, { unreadOnly, limit });
    ok(res, data);
  })
);

router.get(
  '/unread-count',
  asyncHandler(async (req: Request, res: Response) => {
    const data = await notificationService.list(req.user!.id, { unreadOnly: true, limit: 1 });
    ok(res, { unread: data.unread });
  })
);

router.patch(
  '/:id/read',
  asyncHandler(async (req: Request, res: Response) => {
    const updated = await notificationService.markRead(req.user!.id, req.params.id);
    if (!updated) return fail(res, 404, 'Notification not found');
    ok(res, { message: 'Marked as read' });
  })
);

router.post(
  '/read-all',
  asyncHandler(async (req: Request, res: Response) => {
    const count = await notificationService.markAllRead(req.user!.id);
    ok(res, { message: 'All notifications marked as read', count });
  })
);

export default router;
