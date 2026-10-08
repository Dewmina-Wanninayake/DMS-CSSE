import { loadConfig } from '../config/env';
import { openDatabase } from '../core/db/connection';
import { runMigrations } from '../core/db/migrate';

const config = loadConfig();
const applied = runMigrations(openDatabase(config.DATABASE_PATH));
console.log(applied.length ? `Applied: ${applied.join(', ')}` : 'Database is up to date.');
