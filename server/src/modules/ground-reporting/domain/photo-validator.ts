import {
  GroundReportingErrorCode,
  MAX_PHOTO_BYTES,
  PHOTO_MIME_TYPES,
  type PhotoMimeType,
} from '@dms/shared';
import { UnprocessableError, ValidationError } from '../../../core/http/errors';

const JPEG_MAGIC = [0xff, 0xd8, 0xff];
const PNG_MAGIC = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

const startsWith = (bytes: Uint8Array, magic: number[]): boolean =>
  bytes.length >= magic.length && magic.every((value, index) => bytes[index] === value);

/**
 * Critique CV-003 #2 / #6: the photo is optional, but when present it must be a real JPEG or PNG
 * of at most 2 MB (exactly 2 MB is accepted). The browser compresses first; this is the authority.
 */
export class PhotoValidator {
  /** Returns the normalised mime type, or throws a typed error. */
  validate(bytes: Uint8Array, declaredType: string | undefined): PhotoMimeType {
    const mime = (declaredType ?? '').split(';')[0]?.trim().toLowerCase() ?? '';
    if (!isPhotoMime(mime)) {
      throw new UnprocessableError(
        GroundReportingErrorCode.PhotoInvalidType,
        'Photos must be JPEG or PNG images.',
      );
    }
    if (bytes.length === 0) throw new ValidationError('The photo is empty.');
    if (bytes.length > MAX_PHOTO_BYTES) {
      throw new UnprocessableError(
        GroundReportingErrorCode.PhotoTooLarge,
        'The photo is larger than 2 MB. Choose a smaller photo or take a new one.',
      );
    }
    const magic = mime === 'image/png' ? PNG_MAGIC : JPEG_MAGIC;
    if (!startsWith(bytes, magic)) {
      throw new UnprocessableError(
        GroundReportingErrorCode.PhotoInvalidType,
        'The file is not a valid JPEG or PNG image.',
      );
    }
    return mime;
  }
}

function isPhotoMime(value: string): value is PhotoMimeType {
  return (PHOTO_MIME_TYPES as readonly string[]).includes(value);
}
