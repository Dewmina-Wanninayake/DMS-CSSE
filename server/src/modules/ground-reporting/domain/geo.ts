import { SRI_LANKA_BOUNDS } from '@dms/shared';

export interface GeoPoint {
  latitude: number;
  longitude: number;
}

const EARTH_RADIUS_M = 6_371_000;
const toRadians = (degrees: number): number => (degrees * Math.PI) / 180;

/** Great-circle (haversine) distance between two points, in metres. */
export function distanceMeters(a: GeoPoint, b: GeoPoint): number {
  const dLat = toRadians(b.latitude - a.latitude);
  const dLng = toRadians(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRadians(a.latitude)) * Math.cos(toRadians(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** A GPS fix outside Sri Lanka's bounding box is rejected (bounds are inclusive). */
export function isWithinSriLanka(point: GeoPoint): boolean {
  const { minLat, maxLat, minLng, maxLng } = SRI_LANKA_BOUNDS;
  return (
    point.latitude >= minLat &&
    point.latitude <= maxLat &&
    point.longitude >= minLng &&
    point.longitude <= maxLng
  );
}

export interface NearestMatch<T> {
  district: T;
  distanceKm: number;
}

/**
 * Location → district resolver. The `districts` table holds centroids only (no boundaries), so
 * the nearest centroid wins; ties keep the first district in the given order. Assumption A3.
 */
export function nearestDistrict<T extends GeoPoint>(
  point: GeoPoint,
  districts: readonly T[],
): NearestMatch<T> | null {
  let best: NearestMatch<T> | null = null;
  for (const district of districts) {
    const distanceKm = distanceMeters(point, district) / 1000;
    if (best === null || distanceKm < best.distanceKm) best = { district, distanceKm };
  }
  return best;
}
