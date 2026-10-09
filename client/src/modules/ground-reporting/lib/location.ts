import { SRI_LANKA_BOUNDS } from '@dms/shared';

export interface Position {
  latitude: number;
  longitude: number;
}

export class LocationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'LocationError';
  }
}

/** Coarse check on the same bounding box the server enforces. */
export function isInSriLanka({ latitude, longitude }: Position): boolean {
  return (
    latitude >= SRI_LANKA_BOUNDS.minLat &&
    latitude <= SRI_LANKA_BOUNDS.maxLat &&
    longitude >= SRI_LANKA_BOUNDS.minLng &&
    longitude <= SRI_LANKA_BOUNDS.maxLng
  );
}

const GPS_TIMEOUT_MS = 10_000;

/**
 * Step 6: the system captures the location and the user confirms it. Any failure (no GPS, denied,
 * timeout, a fix outside Sri Lanka) becomes a LocationError so the wizard can offer a manual pin (6a).
 */
export function captureLocation(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (!('geolocation' in navigator)) {
      reject(new LocationError('This device cannot find your location.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        const position = { latitude: coords.latitude, longitude: coords.longitude };
        if (isInSriLanka(position)) resolve(position);
        else reject(new LocationError('Your location is outside Sri Lanka.'));
      },
      (error) =>
        reject(
          new LocationError(
            error.code === error.PERMISSION_DENIED
              ? 'Location access is turned off for this app.'
              : 'Your location could not be found.',
          ),
        ),
      { enableHighAccuracy: true, timeout: GPS_TIMEOUT_MS },
    );
  });
}
