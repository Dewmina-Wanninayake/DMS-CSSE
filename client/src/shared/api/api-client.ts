import { API_PREFIX, type ApiResponse, type FieldError, type PageMeta } from '@dms/shared';

const BASE_URL: string = import.meta.env.VITE_API_BASE_URL ?? '';

/** The server answered with the standard failure envelope. */
export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }

  /** Field-level problems from a 400 response, for inline form errors. */
  get fieldErrors(): FieldError[] {
    return Array.isArray(this.details) && this.details.every((d) => d && 'field' in d)
      ? (this.details as FieldError[])
      : [];
  }
}

/** The request never reached the server (offline, DNS, server down): a candidate for "Pending Sync". */
export class NetworkError extends Error {
  constructor() {
    super('The server could not be reached. Check your connection and try again.');
    this.name = 'NetworkError';
  }
}

export interface Page<T> {
  items: T[];
  meta: PageMeta;
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null): void {
  authToken = token;
}

/** Registered once by the auth provider so an expired session returns the user to sign-in. */
export function setUnauthorizedHandler(handler: (() => void) | null): void {
  onUnauthorized = handler;
}

async function send<T>(
  method: string,
  path: string,
  body?: unknown,
  /** Set for a raw upload (e.g. a photo): `body` is then sent as is with this content type. */
  rawContentType?: string,
): Promise<{ data: T; meta?: PageMeta }> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${API_PREFIX}${path}`, {
      method,
      headers: {
        ...(body === undefined ? {} : { 'Content-Type': rawContentType ?? 'application/json' }),
        ...(authToken ? { Authorization: `Bearer ${authToken}` } : {}),
      },
      body: body === undefined ? undefined : rawContentType ? (body as Blob) : JSON.stringify(body),
    });
  } catch {
    throw new NetworkError();
  }

  let payload: ApiResponse<T>;
  try {
    payload = (await response.json()) as ApiResponse<T>;
  } catch {
    throw new ApiError(
      response.status,
      'INVALID_RESPONSE',
      'The server sent an unreadable response.',
    );
  }

  if (!payload.success) {
    if (response.status === 401) onUnauthorized?.();
    throw new ApiError(
      response.status,
      payload.error.code,
      payload.error.message,
      payload.error.details,
    );
  }
  return { data: payload.data, meta: payload.meta };
}

/**
 * Downloads a protected file (for example a report photo) as a Blob. An `<img src>` cannot send the
 * bearer token, so images behind login are fetched here and shown from an object URL.
 */
async function download(path: string): Promise<Blob> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${API_PREFIX}${path}`, {
      headers: authToken ? { Authorization: `Bearer ${authToken}` } : {},
    });
  } catch {
    throw new NetworkError();
  }
  if (!response.ok) {
    throw new ApiError(response.status, 'DOWNLOAD_FAILED', 'The file could not be loaded.');
  }
  return response.blob();
}

export const api = {
  get: async <T>(path: string): Promise<T> => (await send<T>('GET', path)).data,
  post: async <T>(path: string, body?: unknown): Promise<T> =>
    (await send<T>('POST', path, body ?? {})).data,
  put: async <T>(path: string, body: unknown): Promise<T> =>
    (await send<T>('PUT', path, body)).data,
  patch: async <T>(path: string, body: unknown): Promise<T> =>
    (await send<T>('PATCH', path, body)).data,
  /** Fetches a login-protected file; `path` is relative to the API prefix. */
  getBlob: download,
  /** Sends the file bytes as the request body (UC-CV-003 photo upload). */
  putFile: async <T>(path: string, file: Blob): Promise<T> =>
    (await send<T>('PUT', path, file, file.type)).data,
  /** For paginated lists: returns the rows together with the paging meta. */
  getPage: async <T>(path: string): Promise<Page<T>> => {
    const { data, meta } = await send<T[]>('GET', path);
    return { items: data, meta: meta ?? { page: 1, pageSize: data.length, total: data.length } };
  },
};

/** Builds `?a=1&b=2`, skipping undefined values. */
export function toQuery(params: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value !== undefined) query.set(key, String(value));
  }
  const text = query.toString();
  return text ? `?${text}` : '';
}

/** `{ field: message }` for inline form errors from a 400 response (first message per field). */
export function fieldErrorMap(error: unknown): Record<string, string> {
  const map: Record<string, string> = {};
  if (error instanceof ApiError) {
    for (const { field, message } of error.fieldErrors) map[field] ??= message;
  }
  return map;
}

/** A message that is always safe to show to the user. */
export function errorMessage(error: unknown): string {
  return error instanceof Error
    ? error.message
    : 'Something unexpected happened. Please try again.';
}
