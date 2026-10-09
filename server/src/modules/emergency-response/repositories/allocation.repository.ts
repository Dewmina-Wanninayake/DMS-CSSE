import type { Database } from 'better-sqlite3';
import type { AllocationEntry, AllocationEntryType, DestinationType } from '../domain/types';
import type { ResourceUnit } from '../domain/units';

interface AllocationRow {
  id: number;
  entry_type: AllocationEntryType;
  resource_id: number;
  quantity: number;
  unit: ResourceUnit;
  destination_type: DestinationType;
  destination_id: number;
  instructions: string | null;
  reverses_allocation_id: number | null;
  reason: string | null;
  created_by: number;
  created_at: string;
}

export type NewAllocationEntry = Omit<AllocationEntry, 'id'>;

const toEntry = (r: AllocationRow): AllocationEntry => ({
  id: r.id,
  entryType: r.entry_type,
  resourceId: r.resource_id,
  quantity: r.quantity,
  unit: r.unit,
  destinationType: r.destination_type,
  destinationId: r.destination_id,
  instructions: r.instructions,
  reversesAllocationId: r.reverses_allocation_id,
  reason: r.reason,
  createdBy: r.created_by,
  createdAt: r.created_at,
});

/** Append-only ledger: there is deliberately no update or delete method. */
export class AllocationRepository {
  constructor(private readonly db: Database) {}

  insert(e: NewAllocationEntry): number {
    const result = this.db
      .prepare(
        `INSERT INTO resource_allocations
           (entry_type, resource_id, quantity, unit, destination_type, destination_id,
            instructions, reverses_allocation_id, reason, created_by, created_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        e.entryType,
        e.resourceId,
        e.quantity,
        e.unit,
        e.destinationType,
        e.destinationId,
        e.instructions,
        e.reversesAllocationId,
        e.reason,
        e.createdBy,
        e.createdAt,
      );
    return Number(result.lastInsertRowid);
  }

  findById(id: number): AllocationEntry | undefined {
    const row = this.db
      .prepare<[number], AllocationRow>('SELECT * FROM resource_allocations WHERE id = ?')
      .get(id);
    return row ? toEntry(row) : undefined;
  }

  findReversalOf(allocationId: number): AllocationEntry | undefined {
    const row = this.db
      .prepare<[number], AllocationRow>(
        'SELECT * FROM resource_allocations WHERE reverses_allocation_id = ?',
      )
      .get(allocationId);
    return row ? toEntry(row) : undefined;
  }
}
