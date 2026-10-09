import { describe, expect, it } from 'vitest';
import { MinimumEvidenceRule } from '../domain/evidence-rule';

describe('MinimumEvidenceRule', () => {
  const rule = new MinimumEvidenceRule();

  it('3a: should pass when report has GPS location and a photo', () => {
    const result = rule.assess({
      locationSource: 'Gps',
      photoPath: '/uploads/photo.jpg',
      corroborationCount: 0,
    });
    expect(result.sufficient).toBe(true);
    expect(result.hasGps).toBe(true);
    expect(result.hasPhoto).toBe(true);
    expect(result.reasons).toContain('GPS location and photo meet the minimum evidence rule.');
  });

  it('3b: should pass when report has corroborating nearby reports even without photo or GPS', () => {
    const result = rule.assess({
      locationSource: 'Manual',
      photoPath: null,
      corroborationCount: 1,
    });
    expect(result.sufficient).toBe(true);
    expect(result.corroborationCount).toBe(1);
    expect(result.reasons).toContain('A nearby report corroborates this one.');
  });

  it('3c: should fail when report lacks photo and has no corroboration', () => {
    const result = rule.assess({
      locationSource: 'Gps',
      photoPath: null,
      corroborationCount: 0,
    });
    expect(result.sufficient).toBe(false);
    expect(result.reasons).toContain('No photo was attached.');
    expect(result.reasons).toContain('No other report within 2 km / 2 h.');
  });
});
