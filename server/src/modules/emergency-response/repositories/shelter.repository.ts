import type { Database } from 'better-sqlite3';
import type { Shelter } from '../domain/types';

interface ShelterRow {
  id: number;
  name: string;
  district_id: number;
  address: string;
  capacity: number;
  occupied: number;
  occupancy_updated_at: string | null;
}

const SELECT = `
  SELECT s.id, s.name, s.district_id, s.address, s.capacity,
         COALESCE(o.occupied, 0) AS occupied, o.updated_at AS occupancy_updated_at
  FROM shelters s
  LEFT JOIN shelter_occupancy o ON o.shelter_id = s.id`;

const toShelter = (r: ShelterRow): Shelter => ({
  id: r.id,
  name: r.name,
  districtId: r.district_id,
  address: r.address,
  capacity: r.capacity,
  occupied: r.occupied,
  available: Math.max(r.capacity - r.occupied, 0),
  occupancyUpdatedAt: r.occupancy_updated_at,
});

/** READ-ONLY (JOINT #2): this class has no write method on purpose. */
export class ShelterRepository {
  constructor(private readonly db: Database) {}

  list(districtId?: number): Shelter[] {
    const rows =
      districtId === undefined
        ? this.db.prepare<[], ShelterRow>(`${SELECT} ORDER BY s.name`).all()
        : this.db
            .prepare<[number], ShelterRow>(`${SELECT} WHERE s.district_id = ? ORDER BY s.name`)
            .all(districtId);
    return rows.map(toShelter);
  }

  findById(id: number): Shelter | undefined {
    const row = this.db.prepare<[number], ShelterRow>(`${SELECT} WHERE s.id = ?`).get(id);
    return row ? toShelter(row) : undefined;
  }

  /** Shelters with room left, same district first, then most free space. */
  findAlternatives(districtId: number, excludeId: number, limit: number): Shelter[] {
    return this.db
      .prepare<[number, number, number], ShelterRow>(
        `${SELECT}
         WHERE s.id != ? AND s.capacity - COALESCE(o.occupied, 0) > 0
         ORDER BY (s.district_id = ?) DESC, (s.capacity - COALESCE(o.occupied, 0)) DESC
         LIMIT ?`,
      )
      .all(excludeId, districtId, limit)
      .map(toShelter);
  }
}
