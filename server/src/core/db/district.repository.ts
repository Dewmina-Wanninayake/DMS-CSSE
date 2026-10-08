import type { DistrictRef } from '@dms/shared';
import type { Db } from './connection';

export interface District extends DistrictRef {
  population: number;
  areaKm2: number;
}

interface DistrictRow {
  id: number;
  code: string;
  name: string;
  province: string;
  latitude: number;
  longitude: number;
  population: number;
  area_km2: number;
}

const toDistrict = (row: DistrictRow): District => ({
  id: row.id,
  code: row.code,
  name: row.name,
  province: row.province,
  latitude: row.latitude,
  longitude: row.longitude,
  population: row.population,
  areaKm2: row.area_km2,
});

/** Read-only access to the shared district reference table (all modules). */
export class DistrictRepository {
  constructor(private readonly db: Db) {}

  findAll(): District[] {
    return (this.db.prepare('SELECT * FROM districts ORDER BY name').all() as DistrictRow[]).map(
      toDistrict,
    );
  }

  findByIds(ids: number[]): District[] {
    if (ids.length === 0) return [];
    const marks = ids.map(() => '?').join(',');
    return (
      this.db
        .prepare(`SELECT * FROM districts WHERE id IN (${marks}) ORDER BY name`)
        .all(...ids) as DistrictRow[]
    ).map(toDistrict);
  }
}
