import type { RequestHandler } from 'express';
import type { AppConfig } from '../config/env';
import type { TokenService } from './auth/token';
import type { Db } from './db/connection';
import type { DistrictRepository } from './db/district.repository';
import type { UserRepository } from './db/user.repository';
import type { HydrometProvider } from './hydromet/hydromet-provider';
import type { Logger } from './logger';
import type { NotificationService } from './notifications/notification.service';

/**
 * Everything a module needs, built once in the composition root (`createContext`) and passed to
 * `ModuleDefinition.createRouter`. Modules depend on these abstractions, never on each other.
 */
export interface AppContext {
  config: AppConfig;
  db: Db;
  logger: Logger;
  /** Injected so tests can control "today" (period validation, effective dates). */
  clock: () => Date;
  /** Today's date (`YYYY-MM-DD`) in `config.APP_TIMEZONE`; use for every business-date rule. */
  today: () => string;
  tokens: TokenService;
  /** Authenticates the bearer token; apply with `router.use` before role guards. */
  requireAuth: RequestHandler;
  users: UserRepository;
  districts: DistrictRepository;
  notifications: NotificationService;
  hydromet: HydrometProvider;
}
