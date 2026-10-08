import type { AppConfig } from '../config/env';
import { createRequireAuth } from './auth/middleware';
import { createTokenService } from './auth/token';
import type { Db } from './db/connection';
import { DistrictRepository } from './db/district.repository';
import { UserRepository } from './db/user.repository';
import type { AppContext } from './context';
import { dayInZone } from './time';
import { SqliteHydrometProvider } from './hydromet/hydromet-provider';
import type { HydrometProvider } from './hydromet/hydromet-provider';
import { consoleLogger, type Logger } from './logger';
import { InAppNotificationGateway } from './notifications/in-app.gateway';
import { NotificationRepository } from './notifications/notification.repository';
import { NotificationService } from './notifications/notification.service';
import type { NotificationGateway } from './notifications/notification.types';

export interface ContextOverrides {
  logger?: Logger;
  clock?: () => Date;
  gateway?: NotificationGateway;
  hydromet?: HydrometProvider;
}

/** Composition root: builds the shared services once. Overrides exist for tests. */
export function createContext(
  config: AppConfig,
  db: Db,
  overrides: ContextOverrides = {},
): AppContext {
  const logger = overrides.logger ?? consoleLogger;
  const users = new UserRepository(db);
  const tokens = createTokenService(config.JWT_SECRET, config.JWT_EXPIRES_IN);
  const clock = overrides.clock ?? (() => new Date());
  return {
    config,
    db,
    logger,
    clock,
    today: () => dayInZone(clock(), config.APP_TIMEZONE),
    tokens,
    requireAuth: createRequireAuth(tokens),
    users,
    districts: new DistrictRepository(db),
    notifications: new NotificationService(
      new NotificationRepository(db),
      overrides.gateway ?? new InAppNotificationGateway(logger),
      users,
      config.NOTIFICATION_MAX_RETRIES,
      logger,
    ),
    hydromet: overrides.hydromet ?? new SqliteHydrometProvider(db),
  };
}
