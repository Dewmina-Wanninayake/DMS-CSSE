import { describe, expect, it } from 'vitest';
import { RiskLevel } from '@dms/shared';
import { ThresholdRiskClassifier } from '../domain/risk-classifier';
import {
  TREND_STABLE_BAND_PERCENT,
  isSparse,
  percentChange,
  sum,
  trendDirection,
} from '../domain/trend-calculator';

const thresholds = { riskThreshold: 5, mediumRatio: 0.5, minDataPoints: 3 };

describe('ThresholdRiskClassifier (critique DA #4)', () => {
  const classifier = new ThresholdRiskClassifier();

  it('should mark a district High only when the count is above the threshold', () => {
    expect(classifier.classify(6, thresholds)).toBe(RiskLevel.High);
  });

  it('should not mark a district High when the count equals the threshold', () => {
    expect(classifier.classify(5, thresholds)).toBe(RiskLevel.Medium);
  });

  it('should mark Medium from threshold × mediumRatio upwards', () => {
    expect(classifier.classify(2.5, thresholds)).toBe(RiskLevel.Medium);
    expect(classifier.classify(3, thresholds)).toBe(RiskLevel.Medium);
  });

  it('should mark Low below the medium boundary and for zero reports', () => {
    expect(classifier.classify(2, thresholds)).toBe(RiskLevel.Low);
    expect(classifier.classify(0, thresholds)).toBe(RiskLevel.Low);
  });

  it('should follow a changed threshold', () => {
    expect(classifier.classify(6, { ...thresholds, riskThreshold: 10 })).toBe(RiskLevel.Medium);
  });
});

describe('percentChange', () => {
  it('should compute a rounded percentage', () => {
    expect(percentChange(15, 10)).toBe(50);
    expect(percentChange(7, 9)).toBe(-22.2);
  });

  it('should return null when there is no baseline', () => {
    expect(percentChange(4, 0)).toBeNull();
  });
});

describe('trendDirection', () => {
  it('should be Rising above the stable band', () => {
    expect(trendDirection(12, 10)).toBe('Rising');
  });

  it('should be Falling below the stable band', () => {
    expect(trendDirection(8, 10)).toBe('Falling');
  });

  it('should be Stable at exactly the band edge', () => {
    const edge = 10 + TREND_STABLE_BAND_PERCENT / 10;
    expect(trendDirection(edge, 10)).toBe('Stable');
    expect(trendDirection(10 - TREND_STABLE_BAND_PERCENT / 10, 10)).toBe('Stable');
  });

  it('should be Rising when data appears after an empty period', () => {
    expect(trendDirection(3, 0)).toBe('Rising');
  });

  it('should be Stable when both periods are empty', () => {
    expect(trendDirection(0, 0)).toBe('Stable');
  });
});

describe('isSparse (extension 3a)', () => {
  it('should flag fewer data points than the minimum', () => {
    expect(isSparse(2, 3)).toBe(true);
  });

  it('should not flag exactly the minimum', () => {
    expect(isSparse(3, 3)).toBe(false);
  });
});

describe('sum', () => {
  it('should add map values and return 0 for none', () => {
    expect(
      sum(
        new Map([
          [1, 2],
          [2, 5],
        ]).values(),
      ),
    ).toBe(7);
    expect(sum([])).toBe(0);
  });
});
