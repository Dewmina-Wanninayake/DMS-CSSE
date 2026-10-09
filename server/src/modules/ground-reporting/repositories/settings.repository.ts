import type { Db } from '../../../core/db/connection';
import { NotFoundError } from '../../../core/http/errors';

/** Operator-tunable duplicate window, read from `report_settings` so changing it needs no deploy. */
export interface DuplicateSettings {
  radiusMeters: number;
  windowMinutes: number;
}

/** Operator-tunable values for this module (`report_settings`), never hard-coded in services. */
export class ReportSettingsRepository {
  constructor(private readonly db: Db) {}

  duplicateSettings(): DuplicateSettings {
    return {
      radiusMeters: this.get('duplicate_radius_m'),
      windowMinutes: this.get('duplicate_window_minutes'),
    };
  }

  private get(key: string): number {
    const row = this.db.prepare('SELECT value FROM report_settings WHERE key = ?').get(key) as
      { value: number } | undefined;
    if (!row) throw new NotFoundError(`Report setting ${key}`);
    return row.value;
  }
}
