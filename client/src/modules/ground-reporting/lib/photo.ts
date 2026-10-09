import { MAX_PHOTO_BYTES, PHOTO_MIME_TYPES, type PhotoMimeType } from '@dms/shared';

/** Longest side after scaling; a phone photo is far larger than a report needs. */
export const PHOTO_MAX_EDGE_PX = 1600;
/** JPEG qualities tried from best to smallest until the photo fits the 2 MB limit. */
export const PHOTO_QUALITY_STEPS = [0.85, 0.7, 0.55, 0.4, 0.25] as const;

export class PhotoError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PhotoError';
  }
}

const isAllowedType = (type: string): type is PhotoMimeType =>
  (PHOTO_MIME_TYPES as readonly string[]).includes(type);

/** Size after scaling so the longest side is at most `maxEdge`; never enlarges. */
export function scaleToFit(
  width: number,
  height: number,
  maxEdge: number = PHOTO_MAX_EDGE_PX,
): { width: number; height: number } {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) return { width, height };
  const ratio = maxEdge / longest;
  return { width: Math.round(width * ratio), height: Math.round(height * ratio) };
}

function toBlob(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality));
}

/**
 * Critique CV-003 #6: the photo is compressed on the device to at most 2 MB. A JPEG or PNG that
 * already fits is sent as it is; anything else is scaled down and re-encoded as JPEG.
 * @throws PhotoError when the file is not an image or cannot be made small enough.
 */
export async function compressPhoto(file: File | Blob): Promise<Blob> {
  if (!file.type.startsWith('image/')) {
    throw new PhotoError('Choose a photo (JPEG or PNG).');
  }
  if (isAllowedType(file.type) && file.size <= MAX_PHOTO_BYTES) return file;

  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new PhotoError('That photo could not be read. Choose another or continue without one.');
  }
  const { width, height } = scaleToFit(bitmap.width, bitmap.height);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  canvas.getContext('2d')?.drawImage(bitmap, 0, 0, width, height);
  bitmap.close?.();

  for (const quality of PHOTO_QUALITY_STEPS) {
    const blob = await toBlob(canvas, quality);
    if (blob && blob.size <= MAX_PHOTO_BYTES) return blob;
  }
  throw new PhotoError('That photo is too large to send. Choose a smaller one or skip it.');
}

/** Photos wait in the offline queue as data URLs, because localStorage only holds strings. */
export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new PhotoError('The photo could not be saved on this device.'));
    reader.readAsDataURL(blob);
  });
}

/** Inverse of `blobToDataUrl`; restores the compressed photo so it can be uploaded after the report has synced. */
export function dataUrlToBlob(dataUrl: string): Blob {
  const [header, payload = ''] = dataUrl.split(',');
  const mime = /data:([^;]+)/.exec(header)?.[1] ?? 'application/octet-stream';
  const bytes = Uint8Array.from(atob(payload), (char) => char.charCodeAt(0));
  return new Blob([bytes], { type: mime });
}
