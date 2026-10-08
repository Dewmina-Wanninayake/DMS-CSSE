import { z } from 'zod';

function isValidTimeZone(zone: string): boolean {
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: zone });
    return true;
  } catch {
    return false;
  }
}

const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  DATABASE_PATH: z.string().min(1).default('./data/dms.sqlite'),
  JWT_SECRET: z.string().min(16, 'JWT_SECRET must be at least 16 characters'),
  JWT_EXPIRES_IN: z.string().default('8h'),
  CLIENT_ORIGIN: z.string().url().default('http://localhost:5173'),
  NOTIFICATION_RETRY_INTERVAL_MS: z.coerce.number().int().positive().default(60_000),
  NOTIFICATION_MAX_RETRIES: z.coerce.number().int().positive().default(5),
  /** Business time zone: "today" for period and effective-date rules is the date here, not in UTC. */
  APP_TIMEZONE: z
    .string()
    .default('Asia/Colombo')
    .refine(isValidTimeZone, 'APP_TIMEZONE must be an IANA time zone such as Asia/Colombo'),
  SEED_DEFAULT_PASSWORD: z.string().min(8).default('ChangeMe-Dev-2026'),
});

export type AppConfig = z.infer<typeof envSchema>;

/** Parses and validates environment variables; throws a readable error when invalid. */
export function loadConfig(source: NodeJS.ProcessEnv = process.env): AppConfig {
  const parsed = envSchema.safeParse(source);
  if (!parsed.success) {
    const problems = parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; ');
    throw new Error(`Invalid environment configuration: ${problems}`);
  }
  return parsed.data;
}
