import { describe, expect, it } from 'vitest';
import { monthKeys, parseDay, previousPeriod, toBounds, validatePeriod } from '../domain/period';

const TODAY = '2026-10-09';

describe('parseDay', () => {
  it('should parse a real calendar day as UTC midnight', () => {
    expect(parseDay('2026-02-28')?.toISOString()).toBe('2026-02-28T00:00:00.000Z');
  });

  it.each(['2026-02-30', '2026-13-01', '26-01-01', 'yesterday', ''])(
    'should reject the invalid day "%s"',
    (value) => {
      expect(parseDay(value)).toBeNull();
    },
  );
});

describe('validatePeriod', () => {
  it('should accept a normal period ending today', () => {
    expect(validatePeriod('2026-07-01', '2026-10-09', TODAY)).toBeNull();
  });

  it('should reject malformed dates', () => {
    expect(validatePeriod('2026-07-01', 'soon', TODAY)).toMatch(/real calendar days/);
  });

  it('should reject a start date after the end date', () => {
    expect(validatePeriod('2026-08-02', '2026-08-01', TODAY)).toMatch(/start date/);
  });

  it('should reject an end date in the future', () => {
    expect(validatePeriod('2026-10-01', '2026-10-10', TODAY)).toMatch(/future/);
  });

  it('should accept a period of exactly five years and reject one day longer', () => {
    expect(validatePeriod('2021-10-09', '2026-10-09', TODAY)).toBeNull();
    expect(validatePeriod('2021-10-08', '2026-10-09', TODAY)).toMatch(/5 years/);
  });

  it('should accept a single-day period', () => {
    expect(validatePeriod('2026-10-09', '2026-10-09', TODAY)).toBeNull();
  });
});

describe('toBounds', () => {
  it('should cover the whole of both end days', () => {
    expect(toBounds('2026-01-01', '2026-01-31')).toEqual({
      from: '2026-01-01T00:00:00.000Z',
      to: '2026-01-31T23:59:59.999Z',
    });
  });
});

describe('previousPeriod', () => {
  it('should return the equally long period that ends the day before', () => {
    expect(previousPeriod('2026-07-01', '2026-07-31')).toEqual({
      start: '2026-05-31',
      end: '2026-06-30',
    });
  });

  it('should handle a single-day period', () => {
    expect(previousPeriod('2026-03-10', '2026-03-10')).toEqual({
      start: '2026-03-09',
      end: '2026-03-09',
    });
  });
});

describe('monthKeys', () => {
  it('should list every month touched, across a year boundary', () => {
    expect(monthKeys('2025-11-20', '2026-02-03')).toEqual([
      '2025-11',
      '2025-12',
      '2026-01',
      '2026-02',
    ]);
  });

  it('should return one month for a period inside a month', () => {
    expect(monthKeys('2026-03-05', '2026-03-09')).toEqual(['2026-03']);
  });
});
