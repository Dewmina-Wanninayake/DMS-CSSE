import { describe, expect, it } from 'vitest';
import { GroundReportingErrorCode, MAX_PHOTO_BYTES } from '@dms/shared';
import { AppError } from '../../../core/http/errors';
import { PhotoValidator } from '../domain/photo-validator';

const JPEG = [0xff, 0xd8, 0xff, 0xe0];
const PNG = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** A buffer of `size` bytes starting with the given magic bytes. */
const bytes = (magic: number[], size = magic.length): Uint8Array => {
  const buffer = new Uint8Array(size);
  buffer.set(magic.slice(0, size));
  return buffer;
};

const validator = new PhotoValidator();
const failure = (run: () => unknown): AppError => {
  try {
    run();
  } catch (error) {
    return error as AppError;
  }
  throw new Error('expected the validator to throw');
};

describe('PhotoValidator (critique #2, #6)', () => {
  it('should accept a small JPEG and a small PNG', () => {
    expect(validator.validate(bytes(JPEG, 100), 'image/jpeg')).toBe('image/jpeg');
    expect(validator.validate(bytes(PNG, 100), 'image/png')).toBe('image/png');
  });

  it('should normalise the content type (case and parameters)', () => {
    expect(validator.validate(bytes(JPEG, 10), 'IMAGE/JPEG; charset=binary')).toBe('image/jpeg');
  });

  it('should accept exactly 2 MB (size boundary)', () => {
    expect(validator.validate(bytes(JPEG, MAX_PHOTO_BYTES), 'image/jpeg')).toBe('image/jpeg');
  });

  it('should reject 2 MB + 1 byte with PHOTO_TOO_LARGE (422)', () => {
    const error = failure(() => validator.validate(bytes(JPEG, MAX_PHOTO_BYTES + 1), 'image/jpeg'));
    expect(error.statusCode).toBe(422);
    expect(error.code).toBe(GroundReportingErrorCode.PhotoTooLarge);
  });

  it('should accept 2 MB - 1 byte', () => {
    expect(validator.validate(bytes(PNG, MAX_PHOTO_BYTES - 1), 'image/png')).toBe('image/png');
  });

  it.each(['image/gif', 'image/webp', 'application/pdf', 'text/plain', '', undefined])(
    'should reject the content type %s with PHOTO_INVALID_TYPE',
    (type) => {
      const error = failure(() => validator.validate(bytes(JPEG, 10), type));
      expect(error.statusCode).toBe(422);
      expect(error.code).toBe(GroundReportingErrorCode.PhotoInvalidType);
    },
  );

  it('should reject a file whose bytes do not match the declared type', () => {
    expect(failure(() => validator.validate(bytes(PNG, 10), 'image/jpeg')).code).toBe(
      GroundReportingErrorCode.PhotoInvalidType,
    );
    expect(failure(() => validator.validate(bytes(JPEG, 10), 'image/png')).code).toBe(
      GroundReportingErrorCode.PhotoInvalidType,
    );
  });

  it('should reject an empty body with a validation error (400)', () => {
    const error = failure(() => validator.validate(new Uint8Array(0), 'image/png'));
    expect(error.statusCode).toBe(400);
    expect(error.code).toBe('VALIDATION_ERROR');
  });
});
