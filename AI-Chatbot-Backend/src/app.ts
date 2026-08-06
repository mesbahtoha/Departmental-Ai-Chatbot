import crypto from 'crypto';
import express, { Express, NextFunction, Request, Response } from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import mongoSanitize from 'express-mongo-sanitize';
import cookieParser from 'cookie-parser';

import env from './config/env';
import { log } from './config/logger';
import legacyRouter from './app/modules/legacy/legacy.routes';
import v1Router from './routes/v1.routes';
import { globalLimiter } from './middleware/rateLimiter.middleware';
import { errorHandler, notFoundHandler } from './middleware/error.middleware';

/**
 * Express application assembly.
 * Order matters: security headers -> body parsing -> rate limiting ->
 * routes -> 404 -> central error handler.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');

  // Request id (useful for log correlation)
  app.use((req: Request, res: Response, next: NextFunction) => {
    req.requestId = (req.headers['x-request-id'] as string) || crypto.randomUUID();
    res.setHeader('X-Request-Id', req.requestId);
    next();
  });

  // Security headers
  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    })
  );

  // CORS
  const origins = env.corsOrigin.split(',').map((o) => o.trim()).filter(Boolean);
  const allowAll = origins.length === 1 && origins[0] === '*';
  const localhostOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  app.use(
    cors({
      origin: (origin, callback) => {
        // Allow any local dev server (localhost/127.0.0.1 on any port) plus the configured origins.
        if (allowAll || !origin || origins.includes(origin) || localhostOrigin.test(origin)) {
          callback(null, true);
        } else {
          callback(null, false);
        }
      },
      credentials: true,
    })
  );

  // Body parsing
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(cookieParser());

  // MongoDB query injection sanitization
  app.use(mongoSanitize());

  // Compression
  app.use(compression());

  // Simple request logger
  app.use((req: Request, res: Response, next: NextFunction) => {
    res.on('finish', () => {
      if (req.originalUrl.startsWith('/api')) {
        log.http(`${req.method} ${req.originalUrl} ${res.statusCode}`);
      }
    });
    next();
  });

  // Global rate limiter
  app.use('/api', globalLimiter);

  // Legacy compatibility routes (exact original contracts)
  app.use(legacyRouter);

  // Versioned API
  app.use('/api/v1', v1Router);

  // 404 + error handling
  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}

export default createApp;
