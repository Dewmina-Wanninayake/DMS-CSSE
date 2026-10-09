import type { Database } from 'better-sqlite3';
import type { ResupplyRequest } from '../domain/types';

interface ResupplyRow {
  id: number;
  resource_id: number;
  quantity: number;
  note: string | null;
  status: string;
  requested_by: number;
  created_at: string;
}

export interface NewResupplyRequest {
  resourceId: number;
  quantity: number;
  note: string | null;
  requestedBy: number;
  createdAt: string;
}

const toRequest = (r: ResupplyRow): ResupplyRequest => ({
  id: r.id,
  resourceId: r.resource_id,
  quantity: r.quantity,
  note: r.note,
  status: r.status,
  requestedBy: r.requested_by,
  createdAt: r.created_at,
});

export class ResupplyRepository {
  constructor(private readonly db: Database) {}

  insert(r: NewResupplyRequest): ResupplyRequest {
    const result = this.db
      .prepare(
        `INSERT INTO resupply_requests (resource_id, quantity, note, requested_by, created_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(r.resourceId, r.quantity, r.note, r.requestedBy, r.createdAt);
    const row = this.db
      .prepare<[number], ResupplyRow>('SELECT * FROM resupply_requests WHERE id = ?')
      .get(Number(result.lastInsertRowid));
    return toRequest(row as ResupplyRow);
  }
}
