import { IAuditRepository } from '../../application/ports/IAuditRepository'
import { AuditEvent } from '../../application/dtos'
import { DbPool } from './PostgresUserRepository'

/**
 * PostgresAuditRepository — PostgreSQL implementation of IAuditRepository.
 * Persists security audit events to the audit_logs table.
 * All queries use parameterized placeholders to prevent SQL injection.
 */
export class PostgresAuditRepository implements IAuditRepository {
  constructor(private readonly pool: DbPool) {}

  async save(event: AuditEvent): Promise<void> {
    await this.pool.query(
      `INSERT INTO audit_logs (user_id, event_type, occurred_at, ip_address, device_info, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        event.userId,
        event.eventType,
        event.occurredAt.toISOString(),
        event.ipAddress,
        event.deviceInfo ? JSON.stringify(event.deviceInfo) : null,
        event.metadata ? JSON.stringify(event.metadata) : null,
      ]
    )
  }
}
