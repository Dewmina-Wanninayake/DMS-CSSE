import { loadConfig } from './config/env';
import { createApp } from './app';
import { createContext } from './core/create-context';
import { openDatabase } from './core/db/connection';
import { runMigrations } from './core/db/migrate';
import { createWarningService } from './modules/report-verification/routes';

const config = loadConfig();
const db = openDatabase(config.DATABASE_PATH);
runMigrations(db);

const ctx = createContext(config, db);
const app = createApp(ctx);

// Extension 12a: failed notifications are retried periodically until they succeed or run out of retries.
const retryTimer = setInterval(() => {
  ctx.notifications.retryFailed().catch((error: unknown) => {
    ctx.logger.error('Notification retry failed', error);
  });
}, config.NOTIFICATION_RETRY_INTERVAL_MS);
retryTimer.unref();

// UC-DIST-02 extension 10b: a warning that waits too long for a Second Approver goes to the next one.
const warningService = createWarningService(ctx);
const escalationTimer = setInterval(() => {
  warningService.escalateOverdueApprovals().catch((error: unknown) => {
    ctx.logger.error('Approval escalation failed', error);
  });
}, config.NOTIFICATION_RETRY_INTERVAL_MS);
escalationTimer.unref();

app.listen(config.PORT, () => {
  ctx.logger.info(`DMS API listening on http://localhost:${config.PORT}`);
});
