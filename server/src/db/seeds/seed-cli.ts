import { loadConfig } from '../../config/env';
import { openDatabase } from '../../core/db/connection';
import { runMigrations } from '../../core/db/migrate';
import { seedDevData } from './dev-seed';

const config = loadConfig();
if (config.NODE_ENV === 'production') {
  throw new Error('Refusing to load development seed data in production.');
}
const db = openDatabase(config.DATABASE_PATH);
runMigrations(db);
const seeded = seedDevData(db, config.SEED_DEFAULT_PASSWORD);
console.log(
  seeded
    ? `Seeded development data. Sign in with e.g. analyst@dms.lk / director@dms.lk and SEED_DEFAULT_PASSWORD.`
    : 'Database already contains users; nothing seeded.',
);
