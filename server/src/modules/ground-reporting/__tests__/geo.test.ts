import { describe, expect, it } from 'vitest';
import { SRI_LANKA_BOUNDS } from '@dms/shared';
import { distanceMeters, isWithinSriLanka, nearestDistrict } from '../domain/geo';

const COLOMBO = { latitude: 6.93, longitude: 79.86 };
const KANDY = { latitude: 7.29, longitude: 80.63 };

describe('distanceMeters', () => {
  it('should return 0 for the same point', () => {
    expect(distanceMeters(COLOMBO, COLOMBO)).toBe(0);
  });

  it('should be symmetric', () => {
    expect(distanceMeters(COLOMBO, KANDY)).toBeCloseTo(distanceMeters(KANDY, COLOMBO), 6);
  });

  it('should measure Colombo to Kandy at roughly 94 km', () => {
    expect(distanceMeters(COLOMBO, KANDY) / 1000).toBeGreaterThan(90);
    expect(distanceMeters(COLOMBO, KANDY) / 1000).toBeLessThan(100);
  });

  it('should measure 0.001 degrees of latitude at about 111 m', () => {
    const d = distanceMeters(COLOMBO, { ...COLOMBO, latitude: COLOMBO.latitude + 0.001 });
    expect(d).toBeGreaterThan(110);
    expect(d).toBeLessThan(112);
  });
});

describe('isWithinSriLanka ', () => {
  it('should accept a point inside the bounds', () => {
    expect(isWithinSriLanka(KANDY)).toBe(true);
  });

  it('should accept points exactly on every bound', () => {
    const { minLat, maxLat, minLng, maxLng } = SRI_LANKA_BOUNDS;
    expect(isWithinSriLanka({ latitude: minLat, longitude: minLng })).toBe(true);
    expect(isWithinSriLanka({ latitude: maxLat, longitude: maxLng })).toBe(true);
  });

  it.each([
    ['south of', { latitude: SRI_LANKA_BOUNDS.minLat - 0.0001, longitude: 80.5 }],
    ['north of', { latitude: SRI_LANKA_BOUNDS.maxLat + 0.0001, longitude: 80.5 }],
    ['west of', { latitude: 7.5, longitude: SRI_LANKA_BOUNDS.minLng - 0.0001 }],
    ['east of', { latitude: 7.5, longitude: SRI_LANKA_BOUNDS.maxLng + 0.0001 }],
    ['India (Chennai)', { latitude: 13.08, longitude: 80.27 }],
  ])('should reject a point %s the bounds', (_label, point) => {
    expect(isWithinSriLanka(point)).toBe(false);
  });
});

describe('nearestDistrict', () => {
  const districts = [
    { id: 1, name: 'Colombo', ...COLOMBO },
    { id: 2, name: 'Kandy', ...KANDY },
  ];

  it('should pick the district with the nearest centroid', () => {
    const match = nearestDistrict({ latitude: 7.2, longitude: 80.5 }, districts);
    expect(match?.district.name).toBe('Kandy');
    expect(match?.distanceKm).toBeGreaterThan(0);
  });

  it('should report distance 0 on a centroid', () => {
    expect(nearestDistrict(COLOMBO, districts)).toMatchObject({
      district: { id: 1 },
      distanceKm: 0,
    });
  });

  it('should keep the first district on an exact tie', () => {
    const twins = [
      { id: 1, latitude: 7, longitude: 80 },
      { id: 2, latitude: 7, longitude: 80 },
    ];
    expect(nearestDistrict({ latitude: 7.1, longitude: 80 }, twins)?.district.id).toBe(1);
  });

  it('should return null when there are no districts', () => {
    expect(nearestDistrict(COLOMBO, [])).toBeNull();
  });
});
