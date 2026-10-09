import { useRef, useState } from 'react';
import { MAX_PHOTO_BYTES } from '@dms/shared';
import { errorMessage } from '../../../../shared/api/api-client';
import { Button } from '../../../../shared/ui/Button';
import { Alert } from '../../../../shared/ui/feedback';
import { compressPhoto } from '../../lib/photo';
import type { StepProps } from './wizard-types';

/**
 * Step 3: optional photo (camera or gallery), compressed on the device to 2 MB (CV-003 #2, #6).
 * Without a camera the reporter can pick from the gallery or carry on without a photo (5a).
 */
export function PhotoStep({ draft, onChange }: StepProps) {
  const camera = useRef<HTMLInputElement>(null);
  const gallery = useRef<HTMLInputElement>(null);
  const [problem, setProblem] = useState<string>();
  const [busy, setBusy] = useState(false);

  async function choose(file: File | undefined) {
    if (!file) return;
    setBusy(true);
    setProblem(undefined);
    try {
      const photo = await compressPhoto(file);
      onChange({ photo, photoName: file.name });
    } catch (error) {
      setProblem(errorMessage(error));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="stack">
      <p>A photo helps the Duty Officer check your report, but you can continue without one.</p>
      <input
        ref={camera}
        type="file"
        accept="image/*"
        capture="environment"
        className="visually-hidden"
        aria-label="Take a photo"
        onChange={(event) => void choose(event.target.files?.[0])}
      />
      <input
        ref={gallery}
        type="file"
        accept="image/jpeg,image/png"
        className="visually-hidden"
        aria-label="Choose a photo from your gallery"
        onChange={(event) => void choose(event.target.files?.[0])}
      />
      <div className="row">
        <Button variant="secondary" loading={busy} onClick={() => camera.current?.click()}>
          Take a photo
        </Button>
        <Button variant="secondary" loading={busy} onClick={() => gallery.current?.click()}>
          Choose from gallery
        </Button>
      </div>
      {problem && <Alert tone="danger">{problem}</Alert>}
      {draft.photo ? (
        <Alert
          tone="success"
          title="Photo added"
          action={
            <Button
              variant="ghost"
              onClick={() => onChange({ photo: undefined, photoName: undefined })}
            >
              Remove photo
            </Button>
          }
        >
          {draft.photoName} · {(draft.photo.size / 1024 / 1024).toFixed(1)} MB of{' '}
          {MAX_PHOTO_BYTES / 1024 / 1024} MB
        </Alert>
      ) : (
        <p className="muted">No photo added.</p>
      )}
    </div>
  );
}
