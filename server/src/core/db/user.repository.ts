import type { AuthUser, Role } from '@dms/shared';
import type { Db } from './connection';

interface UserRow {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  password_hash: string;
}

export interface UserWithHash extends AuthUser {
  passwordHash: string;
}

const toUser = (row: UserRow): AuthUser => ({
  id: row.id,
  email: row.email,
  fullName: row.full_name,
  role: row.role,
});

export class UserRepository {
  constructor(private readonly db: Db) {}

  findByEmail(email: string): UserWithHash | undefined {
    const row = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as
      UserRow | undefined;
    return row ? { ...toUser(row), passwordHash: row.password_hash } : undefined;
  }

  findById(id: number): AuthUser | undefined {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(id) as UserRow | undefined;
    return row ? toUser(row) : undefined;
  }

  findByRoles(roles: Role[]): AuthUser[] {
    const marks = roles.map(() => '?').join(',');
    return (
      this.db
        .prepare(`SELECT * FROM users WHERE role IN (${marks}) ORDER BY id`)
        .all(...roles) as UserRow[]
    ).map(toUser);
  }

  create(input: { email: string; fullName: string; role: Role; passwordHash: string }): AuthUser {
    const result = this.db
      .prepare('INSERT INTO users (email, full_name, role, password_hash) VALUES (?, ?, ?, ?)')
      .run(input.email, input.fullName, input.role, input.passwordHash);
    return {
      id: Number(result.lastInsertRowid),
      email: input.email,
      fullName: input.fullName,
      role: input.role,
    };
  }
}
