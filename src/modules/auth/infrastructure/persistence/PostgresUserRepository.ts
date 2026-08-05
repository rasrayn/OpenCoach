import { IUserRepository } from '../../domain/repositories/IUserRepository'
import { User } from '../../domain/entities/User'
import { Role } from '../../domain/value-objects/Role'

/**
 * Minimal interface for a node-postgres-compatible Pool.
 * Avoids a hard compile-time dependency on the `pg` package while keeping
 * the repository fully typed.
 */
export interface DbPool {
  query<T = Record<string, unknown>>(
    text: string,
    values?: unknown[]
  ): Promise<{ rows: T[]; rowCount: number | null }>
}

/** Maps a raw DB row to the User domain entity. */
function rowToUser(row: Record<string, unknown>): User {
  return {
    id: row['id'] as string,
    email: row['email'] as string,
    passwordHash: row['password_hash'] as string,
    role: row['role'] as Role,
    emailVerified: row['email_verified'] as boolean,
    isFirstAccess: row['is_first_access'] as boolean,
    createdBy: (row['created_by'] as string | null) ?? null,
    createdAt: new Date(row['created_at'] as string),
    updatedAt: new Date(row['updated_at'] as string),
  }
}

/**
 * PostgresUserRepository — PostgreSQL implementation of IUserRepository.
 * All queries use parameterized placeholders ($1, $2, …) to prevent SQL injection.
 */
export class PostgresUserRepository implements IUserRepository {
  constructor(private readonly pool: DbPool) {}

  async findById(id: string): Promise<User | null> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT id, email, password_hash, role, email_verified, is_first_access,
              created_by, created_at, updated_at
       FROM users
       WHERE id = $1`,
      [id]
    )
    if (result.rows.length === 0) return null
    return rowToUser(result.rows[0])
  }

  async findByEmail(email: string): Promise<User | null> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT id, email, password_hash, role, email_verified, is_first_access,
              created_by, created_at, updated_at
       FROM users
       WHERE email = $1`,
      [email]
    )
    if (result.rows.length === 0) return null
    return rowToUser(result.rows[0])
  }

  async save(
    user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>
  ): Promise<User> {
    const result = await this.pool.query<Record<string, unknown>>(
      `INSERT INTO users (email, password_hash, role, email_verified, is_first_access, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, email, password_hash, role, email_verified, is_first_access,
                 created_by, created_at, updated_at`,
      [
        user.email,
        user.passwordHash,
        user.role,
        user.emailVerified,
        user.isFirstAccess,
        user.createdBy,
      ]
    )
    return rowToUser(result.rows[0])
  }

  async update(
    id: string,
    updates: Partial<Omit<User, 'id' | 'createdAt'>>
  ): Promise<User> {
    // Build the SET clause dynamically from provided fields only.
    const columnMap: Record<string, string> = {
      email: 'email',
      passwordHash: 'password_hash',
      role: 'role',
      emailVerified: 'email_verified',
      isFirstAccess: 'is_first_access',
      createdBy: 'created_by',
      updatedAt: 'updated_at',
    }

    const setClauses: string[] = []
    const values: unknown[] = []
    let paramIndex = 1

    for (const [key, value] of Object.entries(updates)) {
      const column = columnMap[key]
      if (column) {
        setClauses.push(`${column} = $${paramIndex}`)
        values.push(value)
        paramIndex++
      }
    }

    if (setClauses.length === 0) {
      // Nothing to update — return the current record
      const existing = await this.findById(id)
      if (!existing) throw new Error(`User not found: ${id}`)
      return existing
    }

    // Always refresh updated_at unless explicitly provided
    if (!('updatedAt' in updates)) {
      setClauses.push(`updated_at = NOW()`)
    }

    values.push(id)
    const result = await this.pool.query<Record<string, unknown>>(
      `UPDATE users
       SET ${setClauses.join(', ')}
       WHERE id = $${paramIndex}
       RETURNING id, email, password_hash, role, email_verified, is_first_access,
                 created_by, created_at, updated_at`,
      values
    )

    if (result.rows.length === 0) throw new Error(`User not found: ${id}`)
    return rowToUser(result.rows[0])
  }

  async delete(id: string): Promise<void> {
    await this.pool.query(`DELETE FROM users WHERE id = $1`, [id])
  }
}
