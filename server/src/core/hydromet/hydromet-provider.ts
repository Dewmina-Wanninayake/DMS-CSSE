import type { Db } from '../db/connection';

export interface HydrometObservation {
  districtId: number;
  stationName: string;
  observedAt: string;
  rainfallMm: number;
  riverLevelM: number;
}

export interface HydrometQuery {
  districtIds: number[];
  from: string;
  to: string;
}

/**
 * Adapter port for meteorological / hydrological data (critique DA #9 names it as a secondary
 * actor). Consumed by UC-DA-001 (trend enrichment) and UC-DIST-02 (decision support).
 * `getObservations` rejects when the source is unreachable; callers must degrade gracefully.
 */
export interface HydrometProvider {
  getObservations(query: HydrometQuery): HydrometObservation[];
}

interface ObservationRow {
  district_id: number;
  station_name: string;
  observed_at: string;
  rainfall_mm: number;
  river_level_m: number;
}

/** Reads observations ingested into `hydromet_observations` (live feed ingestion is out of scope). */
export class SqliteHydrometProvider implements HydrometProvider {
  constructor(private readonly db: Db) {}

  getObservations({ districtIds, from, to }: HydrometQuery): HydrometObservation[] {
    if (districtIds.length === 0) return [];
    const marks = districtIds.map(() => '?').join(',');
    const rows = this.db
      .prepare(
        `SELECT * FROM hydromet_observations
         WHERE district_id IN (${marks}) AND observed_at >= ? AND observed_at <= ?
         ORDER BY observed_at`,
      )
      .all(...districtIds, from, to) as ObservationRow[];
    return rows.map((row) => ({
      districtId: row.district_id,
      stationName: row.station_name,
      observedAt: row.observed_at,
      rainfallMm: row.rainfall_mm,
      riverLevelM: row.river_level_m,
    }));
  }
}
