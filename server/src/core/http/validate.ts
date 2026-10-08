import type { NextFunction, Request, Response } from 'express';
import type { ZodType } from 'zod';
import type { FieldError } from '@dms/shared';
import { ValidationError } from './errors';

interface Schemas {
  body?: ZodType;
  query?: ZodType;
  params?: ZodType;
}

export interface ValidatedRequest {
  body: unknown;
  query: unknown;
  params: unknown;
}

declare module 'express-serve-static-core' {
  interface Request {
    validated: ValidatedRequest;
  }
}

/** Parses body/query/params with zod and exposes the typed result as `req.validated`. */
export function validate(schemas: Schemas) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const issues: FieldError[] = [];
    const out: ValidatedRequest = { body: req.body, query: req.query, params: req.params };
    for (const part of ['body', 'query', 'params'] as const) {
      const schema = schemas[part];
      if (!schema) continue;
      const result = schema.safeParse(req[part]);
      if (result.success) {
        out[part] = result.data;
      } else {
        for (const issue of result.error.issues) {
          issues.push({
            field: [part === 'body' ? '' : part, ...issue.path].filter(Boolean).join('.'),
            message: issue.message,
          });
        }
      }
    }
    if (issues.length > 0) {
      next(new ValidationError('The request contains invalid data.', issues));
      return;
    }
    req.validated = out;
    next();
  };
}
