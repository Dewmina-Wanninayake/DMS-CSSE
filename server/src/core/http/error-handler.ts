import type { NextFunction, Request, Response } from 'express';
import { ErrorCode } from '@dms/shared';
import { AppError } from './errors';
import type { Logger } from '../logger';

export function notFoundHandler(_req: Request, _res: Response, next: NextFunction): void {
  next(new AppError(404, ErrorCode.NotFound, 'The requested resource was not found.'));
}

/** Maps every thrown error to the standard failure envelope; internals are never leaked. */
export function createErrorHandler(logger: Logger) {
  return (err: unknown, _req: Request, res: Response, _next: NextFunction): void => {
    if (err instanceof AppError) {
      res.status(err.statusCode).json({
        success: false,
        error: { code: err.code, message: err.message, details: err.details },
      });
      return;
    }
    if (isBodyParserError(err)) {
      res.status(400).json({
        success: false,
        error: { code: ErrorCode.ValidationError, message: 'The request body is not valid JSON.' },
      });
      return;
    }
    logger.error('Unhandled error', err);
    res.status(500).json({
      success: false,
      error: { code: ErrorCode.InternalError, message: 'An unexpected error occurred.' },
    });
  };
}

function isBodyParserError(err: unknown): boolean {
  return (
    typeof err === 'object' &&
    err !== null &&
    'type' in err &&
    (err as { type: string }).type === 'entity.parse.failed'
  );
}
