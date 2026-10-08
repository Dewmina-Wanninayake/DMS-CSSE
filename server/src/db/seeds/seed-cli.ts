import { loadConfig } from '../../config/env';
import { openDatabase } from '../../core/db/connection';
import { runMigrations } from '../../core/db/migrate';
import { seedDevData, seedExtraData } from './dev-seed';

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

const extra = seedExtraData(db);
console.log(
  extra
    ? `Added ${extra.reports} reports, ${extra.incidents} historical incidents and ${extra.observations} hydromet readings.`
    : 'Extra data already present; nothing added.',
);
