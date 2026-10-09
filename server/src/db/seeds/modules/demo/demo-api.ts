import type { AddressInfo } from 'node:net';
import { once } from 'node:events';
import type { Server } from 'node:http';
import { createApp } from '../../../../app';
import type { AppContext } from '../../../../core/context';

/** A small demo photo (a flooded road) that passes the photo rules and shows properly in the officer's viewer. */
const DEMO_PHOTO = Buffer.from(
  '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',
  'base64',
);

const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;

export type Json = Record<string, unknown>;

/** Counts of what was created, printed by the seed command. */
export interface DemoSummary {
  reports: number;
  warnings: number;
  policies: number;
  dispatches: number;
  allocations: number;
}

/** A seeded user's view of the API: every call is made with that user's token. */
export interface DemoUser {
  get: (path: string) => Promise<Json & { id: number }>;
  post: (path: string, body?: unknown) => Promise<Json & { id: number }>;
  patch: (path: string, body: unknown) => Promise<Json & { id: number }>;
  photo: (id: number) => Promise<Json & { id: number }>;
}

export interface DemoApi {
  ctx: AppContext;
  /** Signs in as a seeded account. */
  as: (email: string) => DemoUser;
  district: (code: string) => { id: number; latitude: number; longitude: number };
  hoursAgo: (hours: number) => string;
  close: () => void;
}

/**
 * Starts the real app on a free port and returns helpers to call it as seeded users. Going through
 * the API instead of writing rows means the demo data can never be in a state the application itself
 * could not reach. A failed call stops the seed with the server's own explanation.
 */
export async function startDemoApi(ctx: AppContext): Promise<DemoApi> {
  const server: Server = createApp(ctx).listen(0);
  await once(server, 'listening');
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}/api/v1`;
  const now = ctx.clock();

  const as = (email: string): DemoUser => {
    const user = ctx.users.findByEmail(email);
    if (!user) throw new Error(`Seed user ${email} is missing; run the base seed first.`);
    const token = ctx.tokens.sign(user);
    const send = async (method: string, path: string, body?: unknown, raw?: Buffer) => {
      const response = await fetch(`${base}${path}`, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          ...(raw
            ? { 'Content-Type': 'image/jpeg' }
            : body
              ? { 'Content-Type': 'application/json' }
              : {}),
        },
        body: raw ?? (body ? JSON.stringify(body) : undefined),
      });
      const payload = (await response.json()) as {
        success: boolean;
        data: never;
        error?: { message: string; details?: { field: string; message: string }[] };
      };
      if (!payload.success) {
        const details = JSON.stringify(payload.error?.details ?? '');
        throw new Error(
          `Demo seed: ${method} ${path} failed: ${payload.error?.message} ${details}`,
        );
      }
      return payload.data as Json & { id: number };
    };
    return {
      get: (path) => send('GET', path),
      post: (path, body = {}) => send('POST', path, body),
      patch: (path, body) => send('PATCH', path, body),
      photo: (id) => send('PUT', `/reports/${id}/photo`, undefined, DEMO_PHOTO),
    };
  };

  return {
    ctx,
    as,
    district: (code) =>
      ctx.db.prepare('SELECT id, latitude, longitude FROM districts WHERE code = ?').get(code) as {
        id: number;
        latitude: number;
        longitude: number;
      },
    hoursAgo: (hours) => new Date(now.getTime() - hours * HOUR_MS).toISOString(),
    close: () => void server.close(),
  };
}
