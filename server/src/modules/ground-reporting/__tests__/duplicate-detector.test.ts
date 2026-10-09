import { describe, expect, it } from 'vitest';
import { HazardType, ReportStatus } from '@dms/shared';
import {
  DuplicateDetector,
  RadiusTimeWindowRule,
  type ExistingReport,
  type ReportSnapshot,
} from '../domain/duplicate-detector';
import { distanceMeters } from '../domain/geo';

const T0 = '2026-10-09T08:00:00.000Z';
const minutesAfter = (iso: string, minutes: number): string =>
  new Date(Date.parse(iso) + minutes * 60_000).toISOString();

const candidate: ReportSnapshot = {
  hazardType: HazardType.Flood,
  latitude: 7.29,
  longitude: 80.63,
  reportedAt: T0,
};

const existing = (overrides: Partial<ExistingReport> = {}): ExistingReport => ({
  id: 1,
  hazardType: HazardType.Flood,
  latitude: 7.29,
  longitude: 80.63,
  reportedAt: T0,
  status: ReportStatus.Pending,
  duplicateOf: null,
  ...overrides,
});

const detector = new DuplicateDetector(new RadiusTimeWindowRule(200, 60));

describe('RadiusTimeWindowRule', () => {
  const rule = new RadiusTimeWindowRule(200, 60);

  it('should match the same hazard at the same place and time', () => {
    expect(rule.matches(candidate, existing())).toBe(true);
  });

  it('should not match a different hazard type', () => {
    expect(rule.matches(candidate, existing({ hazardType: HazardType.Landslide }))).toBe(false);
  });

  it('should match at exactly the window and not one second beyond (window edge)', () => {
    expect(rule.matches(candidate, existing({ reportedAt: minutesAfter(T0, -60) }))).toBe(true);
    expect(rule.matches(candidate, existing({ reportedAt: minutesAfter(T0, 60) }))).toBe(true);
    const justOutside = new Date(Date.parse(T0) - 60 * 60_000 - 1000).toISOString();
    expect(rule.matches(candidate, existing({ reportedAt: justOutside }))).toBe(false);
  });

  it('should match at exactly the radius and not beyond it (radius edge)', () => {
    const other = existing({ latitude: 7.2915 });
    const gap = distanceMeters(candidate, other);
    expect(new RadiusTimeWindowRule(gap, 60).matches(candidate, other)).toBe(true);
    expect(new RadiusTimeWindowRule(gap - 0.001, 60).matches(candidate, other)).toBe(false);
  });

  it('should not match when the timestamp is unreadable', () => {
    expect(rule.matches(candidate, existing({ reportedAt: 'not-a-date' }))).toBe(false);
  });
});

describe('DuplicateDetector.findOriginalId (6 / critique #6)', () => {
  it('should return null for a new incident', () => {
    expect(detector.findOriginalId(candidate, [])).toBeNull();
    expect(
      detector.findOriginalId(candidate, [existing({ latitude: 7.5, longitude: 80.9 })]),
    ).toBeNull();
  });

  it('should link to the matching report', () => {
    expect(detector.findOriginalId(candidate, [existing({ id: 7 })])).toBe(7);
  });

  it('should link to the earliest of several matches, lowest id on a tie', () => {
    const reports = [
      existing({ id: 9, reportedAt: minutesAfter(T0, -10) }),
      existing({ id: 4, reportedAt: minutesAfter(T0, -30) }),
      existing({ id: 3, reportedAt: minutesAfter(T0, -30) }),
    ];
    expect(detector.findOriginalId(candidate, reports)).toBe(3);
  });

  it('should link to the original when the match is itself a duplicate (no chains)', () => {
    expect(detector.findOriginalId(candidate, [existing({ id: 8, duplicateOf: 2 })])).toBe(2);
  });

  it('should ignore Rejected reports', () => {
    expect(
      detector.findOriginalId(candidate, [existing({ status: ReportStatus.Rejected })]),
    ).toBeNull();
  });

  it('should still link to Verified and NeedsInformation reports', () => {
    expect(
      detector.findOriginalId(candidate, [existing({ id: 5, status: ReportStatus.Verified })]),
    ).toBe(5);
    expect(
      detector.findOriginalId(candidate, [
        existing({ id: 6, status: ReportStatus.NeedsInformation }),
      ]),
    ).toBe(6);
  });

  it('should use the injected rule (Strategy)', () => {
    const never = new DuplicateDetector({ matches: () => false });
    const always = new DuplicateDetector({ matches: () => true });
    expect(never.findOriginalId(candidate, [existing()])).toBeNull();
    expect(always.findOriginalId(candidate, [existing({ id: 2 })])).toBe(2);
  });
});
