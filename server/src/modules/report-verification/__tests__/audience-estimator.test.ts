import { describe, expect, it } from 'vitest';
import { AudienceEstimator } from '../domain/audience-estimator';

describe('AudienceEstimator', () => {
  const estimator = new AudienceEstimator();

  it('6a: should sum population of specified districts', () => {
    const districts = [
      { id: 1, name: 'Colombo', population: 2326000 },
      { id: 2, name: 'Gampaha', population: 2300000 },
    ];
    const result = estimator.estimate(districts);
    expect(result.estimatedAudience).toBe(4626000);
    expect(result.districts).toEqual(districts);
  });

  it('6b: should trigger audience confirmation when audience is >= 10,000', () => {
    const districts = [{ id: 1, name: 'Colombo', population: 15000 }];
    const result = estimator.estimate(districts);
    expect(result.requiresAudienceConfirm).toBe(true);
  });

  it('6c: should not trigger audience confirmation when audience is < 10,000', () => {
    const districts = [{ id: 1, name: 'Small Area', population: 5000 }];
    const result = estimator.estimate(districts);
    expect(result.requiresAudienceConfirm).toBe(false);
  });
});
