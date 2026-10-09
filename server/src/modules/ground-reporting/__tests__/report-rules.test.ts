import { describe, expect, it } from 'vitest';
import { ReportStatus } from '@dms/shared';
import { InvalidStateError } from '../../../core/http/errors';
import {
  REPORTED_AT_FUTURE_TOLERANCE_MS,
  assertFieldUpdateAllowed,
  canChangePhoto,
  statusAfterCitizenUpdate,
  validateReportedAt,
} from '../domain/report-rules';

const NOW = new Date('2026-10-09T10:00:00.000Z');

describe('statusAfterCitizenUpdate (update-report extension, #3)', () => {
  it('should move NeedsInformation back to Pending', () => {
    expect(statusAfterCitizenUpdate(ReportStatus.NeedsInformation)).toBe(ReportStatus.Pending);
  });

  it.each([ReportStatus.Pending, ReportStatus.Verified, ReportStatus.Rejected])(
    'should refuse to update a %s report',
    (status) => {
      expect(() => statusAfterCitizenUpdate(status)).toThrow(InvalidStateError);
    },
  );
});

describe('canChangePhoto', () => {
  it('should allow Pending and NeedsInformation only', () => {
    expect(canChangePhoto(ReportStatus.Pending)).toBe(true);
    expect(canChangePhoto(ReportStatus.NeedsInformation)).toBe(true);
    expect(canChangePhoto(ReportStatus.Verified)).toBe(false);
    expect(canChangePhoto(ReportStatus.Rejected)).toBe(false);
  });
});

describe('assertFieldUpdateAllowed (#7)', () => {
  it.each([ReportStatus.Pending, ReportStatus.Verified, ReportStatus.NeedsInformation])(
    'should allow a field update on a %s report',
    (status) => {
      expect(() => assertFieldUpdateAllowed(status)).not.toThrow();
    },
  );

  it('should refuse a field update on a Rejected report', () => {
    expect(() => assertFieldUpdateAllowed(ReportStatus.Rejected)).toThrow(InvalidStateError);
  });
});

describe('validateReportedAt', () => {
  it('should accept a past time (offline reports keep their original time)', () => {
    expect(validateReportedAt('2026-10-08T22:15:00.000Z', NOW)).toBeNull();
  });

  it('should accept the future tolerance exactly and reject one millisecond beyond', () => {
    const edge = new Date(NOW.getTime() + REPORTED_AT_FUTURE_TOLERANCE_MS).toISOString();
    const over = new Date(NOW.getTime() + REPORTED_AT_FUTURE_TOLERANCE_MS + 1).toISOString();
    expect(validateReportedAt(edge, NOW)).toBeNull();
    expect(validateReportedAt(over, NOW)).toMatch(/future/);
  });

  it('should reject an unreadable date', () => {
    expect(validateReportedAt('yesterday-ish', NOW)).toMatch(/valid date/);
  });
});
