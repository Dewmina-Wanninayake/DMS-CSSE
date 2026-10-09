import { DEMO_ACCOUNTS } from '@dms/shared';
import { loadConfig } from '../../config/env';
import { createContext } from '../../core/create-context';
import { openDatabase } from '../../core/db/connection';
import { runMigrations } from '../../core/db/migrate';
import { seedDevData, seedExtraData } from './dev-seed';
import { seedDemoWorkflows } from './modules/demo-workflows.seed';
import { seedGroundReporting } from './modules/ground-reporting.seed';
import { seedEmergencyResponse } from './modules/emergency-response.seed';

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

seedEmergencyResponse(db);
console.log('Seeded shelters, rescue teams and resources for UC-JOINT-001 (idempotent).');

seedGroundReporting(db);
console.log('Certified the seeded volunteer for field updates (idempotent).');

const demo = await seedDemoWorkflows(createContext(config, db));
console.log(
  demo
    ? `Ran the demo workflows: ${demo.reports} reports, ${demo.warnings} warnings, ${demo.policies} policies, ${demo.dispatches} dispatches, ${demo.allocations} allocations.`
    : 'Demo workflows already present; nothing added.',
);

console.log(`
Sign in with any account below. Password: ${config.SEED_DEFAULT_PASSWORD}`);
console.table(DEMO_ACCOUNTS.map(({ email, role, useCase }) => ({ email, role, useCase })));
