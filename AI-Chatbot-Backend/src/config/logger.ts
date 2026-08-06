import winston from 'winston';

/**
 * Application logger (winston).
 * - Console transport for development / serverless output
 * - A Mongo-backed transport is registered later (see config/logger-mongo.ts)
 *   to persist application logs for the admin "Logs" panel.
 */
const logFormat = winston.format.combine(
  winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
  winston.format.errors({ stack: true }),
  winston.format.printf(({ level, message, timestamp, stack, ...meta }) => {
    const metaString = Object.keys(meta).length
      ? ` ${JSON.stringify(meta)}`
      : '';
    return `${timestamp} [${level.toUpperCase()}] ${message}${stack ? `\n${stack}` : ''}${metaString}`;
  })
);

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: logFormat,
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize({ level: true }),
        logFormat
      ),
    }),
  ],
});

/** Structured log helper used across the app. */
export const log = {
  error: (message: string, meta?: Record<string, unknown>) =>
    logger.error(message, meta),
  warn: (message: string, meta?: Record<string, unknown>) =>
    logger.warn(message, meta),
  info: (message: string, meta?: Record<string, unknown>) =>
    logger.info(message, meta),
  http: (message: string, meta?: Record<string, unknown>) =>
    logger.http(message, meta),
  debug: (message: string, meta?: Record<string, unknown>) =>
    logger.debug(message, meta),
};

export default logger;
