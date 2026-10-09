import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { MAX_PHOTO_BYTES } from '@dms/shared';
import {
  loadPendingReports,
  markPendingConflicts,
  removePendingReports,
  savePendingReport,
  type PendingReport,
} from '../lib/pending-reports';
import { LocationError, captureLocation, isInSriLanka } from '../lib/location';
import {
  PHOTO_MAX_EDGE_PX,
  PhotoError,
  blobToDataUrl,
  compressPhoto,
  dataUrlToBlob,
  scaleToFit,
} from '../lib/photo';

describe('scaleToFit', () => {
  it.each([
    [800, 600, 800, 600],
    [PHOTO_MAX_EDGE_PX, 900, PHOTO_MAX_EDGE_PX, 900],
    [4000, 3000, 1600, 1200],
    [3000, 6000, 800, 1600],
  ])('%i x %i becomes %i x %i', (width, height, expectedWidth, expectedHeight) => {
    expect(scaleToFit(width, height)).toEqual({ width: expectedWidth, height: expectedHeight });
  });
});

describe('compressPhoto (critique CV-003 #6: at most 2 MB)', () => {
  afterEach(() => vi.unstubAllGlobals());

  const file = (type: string, size: number) => new File([new Uint8Array(size)], 'photo', { type });

  it('should send a JPEG or PNG that already fits as it is', async () => {
    const jpeg = file('image/jpeg', MAX_PHOTO_BYTES);
    expect(await compressPhoto(jpeg)).toBe(jpeg);
    const png = file('image/png', 10);
    expect(await compressPhoto(png)).toBe(png);
  });

  it('should refuse a file that is not an image', async () => {
    await expect(compressPhoto(file('application/pdf', 10))).rejects.toThrow('Choose a photo');
  });

  function stubCanvas(sizes: number[]) {
    const bitmap = { width: 4000, height: 3000, close: vi.fn() };
    vi.stubGlobal('createImageBitmap', vi.fn().mockResolvedValue(bitmap));
    const drawImage = vi.fn();
    const toBlob = vi.fn((callback: (blob: Blob | null) => void) => {
      const size = sizes.shift();
      callback(
        size === undefined ? null : new Blob([new Uint8Array(size)], { type: 'image/jpeg' }),
      );
    });
    const canvas = { width: 0, height: 0, getContext: () => ({ drawImage }), toBlob };
    vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLElement);
    return { canvas, drawImage, bitmap, toBlob };
  }

  it('should scale an oversized photo down and lower the quality until it fits', async () => {
    const { canvas, drawImage, bitmap, toBlob } = stubCanvas([
      MAX_PHOTO_BYTES + 1,
      MAX_PHOTO_BYTES,
    ]);
    const result = await compressPhoto(file('image/jpeg', MAX_PHOTO_BYTES + 1));
    expect(result.size).toBe(MAX_PHOTO_BYTES);
    expect(result.type).toBe('image/jpeg');
    expect([canvas.width, canvas.height]).toEqual([1600, 1200]);
    expect(drawImage).toHaveBeenCalledWith(bitmap, 0, 0, 1600, 1200);
    expect(toBlob).toHaveBeenCalledTimes(2);
    expect(bitmap.close).toHaveBeenCalled();
  });

  it('should re-encode a GIF as JPEG', async () => {
    stubCanvas([1000]);
    expect((await compressPhoto(file('image/gif', 100))).type).toBe('image/jpeg');
  });

  it('should give up when no quality fits, or when the encoder returns nothing', async () => {
    stubCanvas(Array(5).fill(MAX_PHOTO_BYTES + 1));
    await expect(compressPhoto(file('image/jpeg', MAX_PHOTO_BYTES + 1))).rejects.toThrow(
      'too large to send',
    );
    stubCanvas([]);
    await expect(compressPhoto(file('image/jpeg', MAX_PHOTO_BYTES + 1))).rejects.toBeInstanceOf(
      PhotoError,
    );
  });

  it('should explain an unreadable image', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn().mockRejectedValue(new Error('bad')));
    await expect(compressPhoto(file('image/png', MAX_PHOTO_BYTES + 1))).rejects.toThrow(
      'could not be read',
    );
  });
});

describe('data URL round trip for the offline queue', () => {
  it('should keep the bytes and the type', async () => {
    const original = new Blob([new Uint8Array([1, 2, 3, 255])], { type: 'image/png' });
    const url = await blobToDataUrl(original);
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
    const back = dataUrlToBlob(url);
    expect(back.type).toBe('image/png');
    expect(back.size).toBe(4);
    expect(await blobToDataUrl(back)).toBe(url);
  });

  it('should fall back to a generic type for a malformed URL', () => {
    expect(dataUrlToBlob('nonsense').type).toBe('application/octet-stream');
  });

  it('should report a photo that cannot be read', async () => {
    class FailingReader {
      onerror: (() => void) | null = null;
      readAsDataURL() {
        this.onerror?.();
      }
    }
    vi.stubGlobal('FileReader', FailingReader);
    await expect(blobToDataUrl(new Blob(['x']))).rejects.toBeInstanceOf(PhotoError);
    vi.unstubAllGlobals();
  });
});

describe('location', () => {
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    [7.25, 80.35, true],
    [5.8, 79.4, true],
    [9.95, 82.0, true],
    [5.79, 80, false],
    [9.96, 80, false],
    [7, 79.39, false],
    [7, 82.01, false],
  ])('(%d, %d) in Sri Lanka: %s', (latitude, longitude, expected) => {
    expect(isInSriLanka({ latitude, longitude })).toBe(expected);
  });

  const geolocation = (outcome: 'ok' | 'outside' | 'denied' | 'unavailable') => ({
    getCurrentPosition: (
      success: (position: { coords: { latitude: number; longitude: number } }) => void,
      failure: (error: { code: number; PERMISSION_DENIED: number }) => void,
    ) => {
      if (outcome === 'ok') success({ coords: { latitude: 7.25, longitude: 80.35 } });
      else if (outcome === 'outside') success({ coords: { latitude: 51.5, longitude: 0 } });
      else failure({ code: outcome === 'denied' ? 1 : 2, PERMISSION_DENIED: 1 });
    },
  });

  it('should return the GPS fix', async () => {
    vi.stubGlobal('navigator', { geolocation: geolocation('ok') });
    expect(await captureLocation()).toEqual({ latitude: 7.25, longitude: 80.35 });
  });

  it.each([
    ['outside', 'outside Sri Lanka'],
    ['denied', 'turned off'],
    ['unavailable', 'could not be found'],
  ] as const)('6a: %s fails with a message the reporter can act on', async (outcome, text) => {
    vi.stubGlobal('navigator', { geolocation: geolocation(outcome) });
    await expect(captureLocation()).rejects.toThrow(text);
    await expect(captureLocation()).rejects.toBeInstanceOf(LocationError);
  });

  it('should fail when the device has no geolocation', async () => {
    vi.stubGlobal('navigator', {});
    await expect(captureLocation()).rejects.toThrow('cannot find your location');
  });
});

describe('offline report storage (extension 9b)', () => {
  const report = (overrides: Partial<PendingReport> = {}): PendingReport => ({
    clientId: 'a',
    ownerId: 1,
    savedAt: '2026-10-09T08:00:00.000Z',
    hazardType: 'Flood',
    description: 'Water rising',
    latitude: 7.25,
    longitude: 80.35,
    locationSource: 'Gps',
    ...overrides,
  });

  beforeEach(() => window.localStorage.clear());

  it('should keep only the owner’s reports, oldest first', () => {
    savePendingReport(report({ clientId: 'late', savedAt: '2026-10-09T09:00:00.000Z' }));
    savePendingReport(report({ clientId: 'early', savedAt: '2026-10-09T07:00:00.000Z' }));
    savePendingReport(report({ clientId: 'other', ownerId: 2 }));
    expect(loadPendingReports(1).map((r) => r.clientId)).toEqual(['early', 'late']);
  });

  it('should replace a report saved again with the same clientId', () => {
    savePendingReport(report({ description: 'first' }));
    savePendingReport(report({ description: 'second' }));
    expect(loadPendingReports(1)).toHaveLength(1);
    expect(loadPendingReports(1)[0].description).toBe('second');
  });

  it('should remove uploaded reports and flag refused ones', () => {
    savePendingReport(report({ clientId: 'sent' }));
    savePendingReport(report({ clientId: 'stuck' }));
    removePendingReports(['sent']);
    markPendingConflicts({ stuck: 'Latitude is outside Sri Lanka.' });
    expect(loadPendingReports(1)).toEqual([
      expect.objectContaining({
        clientId: 'stuck',
        conflictMessage: 'Latitude is outside Sri Lanka.',
      }),
    ]);
  });

  it('should survive corrupt or blocked storage', () => {
    window.localStorage.setItem('dms.groundReporting.pendingReports', '{not json');
    expect(loadPendingReports(1)).toEqual([]);
    window.localStorage.setItem('dms.groundReporting.pendingReports', '{"a":1}');
    expect(loadPendingReports(1)).toEqual([]);

    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('quota');
    });
    expect(savePendingReport(report())).toBe(false);
    vi.restoreAllMocks();
  });
});
