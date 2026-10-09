import type { Database } from 'better-sqlite3';

export interface DestinationRef {
  id: number;
  name: string;
}

/** Read-only lookups for allocation destinations other than shelters (critique JOINT #7: Area, Team). */
export class DestinationRepository {
  constructor(private readonly db: Database) {}

  /** An Area is a district: stock is sent to a place that has no shelter yet. */
  findArea(id: number): DestinationRef | undefined {
    return this.db
      .prepare<[number], DestinationRef>('SELECT id, name FROM districts WHERE id = ?')
      .get(id);
  }

  listAreas(): DestinationRef[] {
    return this.db
      .prepare<[], DestinationRef>('SELECT id, name FROM districts ORDER BY name')
      .all();
  }

  findTeam(id: number): DestinationRef | undefined {
    return this.db
      .prepare<[number], DestinationRef>('SELECT id, name FROM rescue_teams WHERE id = ?')
      .get(id);
  }
}
