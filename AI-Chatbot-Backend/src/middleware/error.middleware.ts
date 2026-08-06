import { NextFunction, Request, Response } from 'express';
import multer from 'multer';
import { QuotaExceededError } from '../services/quota.service';
import { log } from '../config/logger';

/** Central error handler - maps known errors to clean JSON responses. */
export function errorHandler(error: unknown, req: Request, res: Response, next: NextFunction) {
  // Multer errors
  if (error instanceof multer.MulterError) {
    return res.status(400).json({ success: false, message: error.message });
  }

  // Custom app errors with statusCode
  if (error instanceof QuotaExceededError) {
    return res.status(429).json({ success: false, message: error.message });
  }

  const err = error as Error & { statusCode?: number };

  if (err?.statusCode) {
    return res.status(err.statusCode).json({ success: false, message: err.message });
  }

  // Mongoose validation / cast errors
  if (err?.name === 'ValidationError') {
    return res.status(400).json({ success: false, message: err.message });
  }

  if (err?.name === 'CastError') {
    return res.status(400).json({ success: false, message: 'Invalid id format' });
  }

  if (err?.name === 'MongoServerError' && (err as { code?: number }).code === 11000) {
    return res.status(409).json({ success: false, message: 'Duplicate value: resource already exists' });
  }

  log.error('Unhandled error', { message: err?.message, stack: err?.stack, url: req.originalUrl });

  return res.status(500).json({
    success: false,
    message: 'Internal server error',
  });
}

/** 404 handler for unknown routes. */
export function notFoundHandler(req: Request, res: Response) {
  res.status(404).json({ success: false, message: `Route not found: ${req.method} ${req.originalUrl}` });
}
