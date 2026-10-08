import type { Response } from 'express';
import type { PageMeta } from '@dms/shared';

/** Sends a success envelope: `{ success: true, data, meta? }`. */
export function sendOk<T>(res: Response, data: T, status = 200, meta?: PageMeta): void {
  res.status(status).json(meta ? { success: true, data, meta } : { success: true, data });
}

export function sendNoContent(res: Response): void {
  res.status(204).end();
}
