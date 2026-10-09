import type { Database } from 'better-sqlite3';
import type { Resource } from '../domain/types';
import type { ResourceUnit } from '../domain/units';

interface ResourceRow {
  id: number;
  name: string;
  unit: ResourceUnit;
  quantity: number;
  owner: string;
  location: string;
}

export class ResourceRepository {
  constructor(private readonly db: Database) {}

  list(): Resource[] {
    return this.db.prepare<[], ResourceRow>('SELECT * FROM resources ORDER BY name').all();
  }

  findById(id: number): Resource | undefined {
    return this.db.prepare<[number], ResourceRow>('SELECT * FROM resources WHERE id = ?').get(id);
  }

  /**
   * Atomic guarded decrement. Returns false (and changes nothing) when stock is
   * lower than `quantity`, so a lost race can never drive stock negative.
   */
  deduct(id: number, quantity: number): boolean {
    const result = this.db
      .prepare('UPDATE resources SET quantity = quantity - ? WHERE id = ? AND quantity >= ?')
      .run(quantity, id, quantity);
    return result.changes === 1;
  }

  restore(id: number, quantity: number): void {
    this.db.prepare('UPDATE resources SET quantity = quantity + ? WHERE id = ?').run(quantity, id);
  }
}
