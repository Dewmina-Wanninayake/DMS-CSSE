import { ReportStatus } from '@dms/shared';
import { InvalidStateError } from '../../../core/http/errors';

/** A device clock may run slightly ahead of the server; anything further out is rejected. */
export const REPORTED_AT_FUTURE_TOLERANCE_MS = 5 * 60_000;

const PHOTO_EDITABLE: readonly ReportStatus[] = [
  ReportStatus.Pending,
  ReportStatus.NeedsInformation,
];

/** Photos can be added or replaced only while the report is still open to the citizen. */
export function canChangePhoto(status: ReportStatus): boolean {
  return PHOTO_EDITABLE.includes(status);
}

/**
 * Critique CV-003 #3 (update-report extension): the only citizen transition is
 * NeedsInformation → Pending. Every other status is final for the citizen (409).
 */
export function statusAfterCitizenUpdate(current: ReportStatus): ReportStatus {
  if (current !== ReportStatus.NeedsInformation) {
    throw new InvalidStateError(
      `A ${current} report cannot be updated; only reports that need more information can.`,
    );
  }
  return ReportStatus.Pending;
}

/** Critique CV-003 #7: a field update on a Rejected report is pointless and refused (409). */
export function assertFieldUpdateAllowed(status: ReportStatus): void {
  if (status === ReportStatus.Rejected) {
    throw new InvalidStateError('A rejected report cannot receive field updates.');
  }
}

/** Returns an error message, or null when `reportedAt` is a valid, not-in-the-future ISO timestamp. */
export function validateReportedAt(reportedAt: string, now: Date): string | null {
  const time = Date.parse(reportedAt);
  if (Number.isNaN(time)) return 'The report time is not a valid date.';
  if (time > now.getTime() + REPORTED_AT_FUTURE_TOLERANCE_MS) {
    return 'The report time cannot be in the future.';
  }
  return null;
}
