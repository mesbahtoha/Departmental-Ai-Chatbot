import { NextFunction, Request, RequestHandler, Response } from 'express';

/** Wraps async route handlers so rejected promises reach the error middleware. */
export function asyncHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<unknown>
): RequestHandler {
  return (req, res, next) => {
    fn(req, res, next).catch(next);
  };
}

/** Standard success envelope. */
export function ok<T>(res: Response, data: T, status = 200): Response {
  return res.status(status).json({ success: true, ...data });
}

export function fail(res: Response, status: number, message: string): Response {
  return res.status(status).json({ success: false, message });
}
