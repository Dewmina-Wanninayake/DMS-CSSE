import type { Database } from 'better-sqlite3';
import type { Dispatch, Priority } from '../domain/types';
import { DispatchStatus } from '../domain/team-status';

interface DispatchRow {
  id: number;
  location: string;
  priority: Priority;
  team_id: number;
  instructions: string | null;
  status: DispatchStatus;
  cancel_reason: string | null;
  replaces_dispatch_id: number | null;
  created_by: number;
  created_at: string;
  updated_at: string;
}

export interface NewDispatch {
  location: string;
  priority: Priority;
  teamId: number;
  instructions: string | null;
  replacesDispatchId: number | null;
  createdBy: number;
  createdAt: string;
}

const toDispatch = (r: DispatchRow): Dispatch => ({
  id: r.id,
  location: r.location,
  priority: r.priority,
  teamId: r.team_id,
  instructions: r.instructions,
  status: r.status,
  cancelReason: r.cancel_reason,
  replacesDispatchId: r.replaces_dispatch_id,
  createdBy: r.created_by,
  createdAt: r.created_at,
  updatedAt: r.updated_at,
});

/** Data access only. Whether a status move is legal is decided by `TeamStatusMachine`, never here. */
export class DispatchRepository {
  constructor(private readonly db: Database) {}

  insert(d: NewDispatch): number {
    const result = this.db
      .prepare(
        `INSERT INTO dispatches
           (location, priority, team_id, instructions, status, replaces_dispatch_id,
            created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        d.location,
        d.priority,
        d.teamId,
        d.instructions,
        DispatchStatus.Dispatched,
        d.replacesDispatchId,
        d.createdBy,
        d.createdAt,
        d.createdAt,
      );
    return Number(result.lastInsertRowid);
  }

  findById(id: number): Dispatch | undefined {
    const row = this.db
      .prepare<[number], DispatchRow>('SELECT * FROM dispatches WHERE id = ?')
      .get(id);
    return row ? toDispatch(row) : undefined;
  }

  updateStatus(id: number, status: DispatchStatus, at: string, cancelReason: string | null): void {
    this.db
      .prepare(
        `UPDATE dispatches
         SET status = ?, cancel_reason = COALESCE(?, cancel_reason), updated_at = ?
         WHERE id = ?`,
      )
      .run(status, cancelReason, at, id);
  }

  /** Dispatches that are neither Completed nor Cancelled, newest first. */
  listActive(): Dispatch[] {
    return this.db
      .prepare<[string, string], DispatchRow>(
        'SELECT * FROM dispatches WHERE status NOT IN (?, ?) ORDER BY id DESC',
      )
      .all(DispatchStatus.Completed, DispatchStatus.Cancelled)
      .map(toDispatch);
  }

  /** A team leader's own open dispatches (Rescue Team Leader screen, critique JOINT #6), newest first. */
  listActiveForLeader(userId: number): Dispatch[] {
    return this.db
      .prepare<[number, string, string], DispatchRow>(
        `SELECT d.* FROM dispatches d JOIN rescue_teams t ON t.id = d.team_id
         WHERE t.leader_user_id = ? AND d.status NOT IN (?, ?) ORDER BY d.id DESC`,
      )
      .all(userId, DispatchStatus.Completed, DispatchStatus.Cancelled)
      .map(toDispatch);
  }
}
