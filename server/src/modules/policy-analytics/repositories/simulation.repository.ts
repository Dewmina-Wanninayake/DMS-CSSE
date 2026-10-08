import type { HazardType, SimulationResult } from '@dms/shared';
import type { Db } from '../../../core/db/connection';
import { formatSimulationReference } from '../domain/identifiers';

type StoredResult = Omit<SimulationResult, 'id' | 'policyId' | 'reference' | 'createdAt'>;

interface Row {
  id: number;
  policy_id: number;
  reference: string;
  result_json: string;
  created_at: string;
}

const toResult = (row: Row): SimulationResult => ({
  ...(JSON.parse(row.result_json) as StoredResult),
  id: row.id,
  policyId: row.policy_id,
  reference: row.reference,
  createdAt: row.created_at,
});

export class SimulationRepository {
  constructor(private readonly db: Db) {}

  /** Stores a run; the reference (`S-2026-0007`) is derived from the new row id. */
  insert(
    policyId: number,
    hazardType: HazardType,
    year: number,
    result: StoredResult,
  ): SimulationResult {
    const insertRun = this.db.transaction(() => {
      const placeholder = `PENDING-${policyId}-${Date.now()}-${Math.random()}`;
      const inserted = this.db
        .prepare(
          `INSERT INTO policy_simulations (policy_id, reference, hazard_type, input_json, result_json)
           VALUES (?, ?, ?, ?, ?)`,
        )
        .run(
          policyId,
          placeholder,
          hazardType,
          JSON.stringify(result.input),
          JSON.stringify(result),
        );
      const id = Number(inserted.lastInsertRowid);
      this.db
        .prepare('UPDATE policy_simulations SET reference = ? WHERE id = ?')
        .run(formatSimulationReference(year, id), id);
      return id;
    });
    return this.getById(insertRun());
  }

  getById(id: number): SimulationResult {
    return toResult(
      this.db.prepare('SELECT * FROM policy_simulations WHERE id = ?').get(id) as Row,
    );
  }

  listByPolicy(policyId: number): SimulationResult[] {
    return (
      this.db
        .prepare('SELECT * FROM policy_simulations WHERE policy_id = ? ORDER BY id DESC')
        .all(policyId) as Row[]
    ).map(toResult);
  }

  latestReference(policyId: number): string | null {
    const row = this.db
      .prepare(
        'SELECT reference FROM policy_simulations WHERE policy_id = ? ORDER BY id DESC LIMIT 1',
      )
      .get(policyId) as { reference: string } | undefined;
    return row?.reference ?? null;
  }
}
