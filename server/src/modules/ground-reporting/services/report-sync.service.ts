import type { AuthUser, ReportSyncResultItem } from '@dms/shared';
import { ConflictError, ValidationError } from '../../../core/http/errors';
import { syncItem } from '../schemas/ground-reporting.schemas';
import type { ReportSubmissionService } from './report-submission.service';

const fieldOf = (issue: { path: PropertyKey[] }): string => issue.path.map(String).join('.');

/** Offline queue: uploads the device's offline queue, idempotent by `clientId`. */
export class ReportSyncService {
  constructor(private readonly submission: ReportSubmissionService) {}

  /**
   * Handles items strictly in the order given (the queue's creation order). Each item succeeds
   * or fails on its own, so one bad report never blocks the rest of the batch.
   */
  sync(reporter: AuthUser, items: unknown[]): ReportSyncResultItem[] {
    return items.map((raw) => this.syncOne(reporter, raw));
  }

  private syncOne(reporter: AuthUser, raw: unknown): ReportSyncResultItem {
    const parsed = syncItem.safeParse(raw);
    if (!parsed.success) {
      return {
        clientId: readClientId(raw),
        outcome: 'Invalid',
        errors: parsed.error.issues.map((issue) => ({
          field: fieldOf(issue),
          message: issue.message,
        })),
      };
    }
    const input = parsed.data;
    try {
      const { report, created } = this.submission.submit(reporter, input);
      return { clientId: input.clientId, outcome: created ? 'Created' : 'Existing', report };
    } catch (error) {
      if (error instanceof ConflictError) {
        return {
          clientId: input.clientId,
          outcome: 'Conflict',
          errors: [{ field: 'clientId', message: error.message }],
        };
      }
      if (error instanceof ValidationError) {
        return {
          clientId: input.clientId,
          outcome: 'Invalid',
          errors: (error.details as { field: string; message: string }[] | undefined) ?? [],
        };
      }
      throw error;
    }
  }
}

function readClientId(raw: unknown): string {
  if (typeof raw === 'object' && raw !== null && 'clientId' in raw) {
    const value = (raw as { clientId: unknown }).clientId;
    if (typeof value === 'string') return value;
  }
  return '';
}
