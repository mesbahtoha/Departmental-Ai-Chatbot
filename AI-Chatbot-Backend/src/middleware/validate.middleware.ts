import { NextFunction, Request, Response } from 'express';
import { ZodSchema } from 'zod';

/**
 * Request validation middleware using Zod schemas.
 * Validates body (default), query and params as needed.
 */
export function validate(schema: ZodSchema, source: 'body' | 'query' | 'params' = 'body') {
  return (req: Request, res: Response, next: NextFunction) => {
    const result = schema.safeParse(req[source]);

    if (!result.success) {
      const firstError = result.error.issues[0];
      const message = firstError
        ? `${firstError.path.join('.') || source}: ${firstError.message}`
        : 'Validation failed';

      return res.status(400).json({ success: false, message });
    }

    req[source] = result.data;
    next();
  };
}
