import { useEffect, useState } from 'react';
import { API_PREFIX } from '@dms/shared';
import { api } from '../api/api-client';

interface AuthImageProps {
  /** API path of the image, with or without the `/api/v1` prefix. */
  src: string;
  alt: string;
  className?: string;
}

/**
 * An image served behind login. The browser cannot attach the bearer token to `<img src>`, so the
 * file is fetched with the shared API client and shown from an object URL (released on unmount).
 * While it loads, or if it fails, a short text stands in so the screen is never left with a broken image.
 */
export function AuthImage({ src, alt, className }: AuthImageProps) {
  const [url, setUrl] = useState<string>();
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    let objectUrl: string | undefined;
    let cancelled = false;
    setUrl(undefined);
    setFailed(false);
    api
      .getBlob(src.startsWith(API_PREFIX) ? src.slice(API_PREFIX.length) : src)
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setUrl(objectUrl);
      })
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [src]);

  if (failed) return <p className="muted">The photo could not be loaded.</p>;
  if (!url) return <p className="muted">Loading photo…</p>;
  return <img src={url} alt={alt} className={className} />;
}
