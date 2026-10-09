import type { AuthUser } from '@dms/shared';
import { ForbiddenError, NotFoundError } from '../../../core/http/errors';
import type { ReportRecord, ReportRepository } from '../repositories/report.repository';

/** Loads a report the caller owns: 404 when it does not exist, 403 when it is someone else's. */
export function loadOwnedReport(
  reports: ReportRepository,
  user: AuthUser,
  reportId: number,
): ReportRecord {
  const record = reports.findById(reportId);
  if (!record) throw new NotFoundError('Report');
  if (record.reporterId !== user.id) throw new ForbiddenError('This is not your report.');
  return record;
}
