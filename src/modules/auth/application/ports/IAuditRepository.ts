import { AuditEvent } from '../dtos'

export interface IAuditRepository {
  save(event: AuditEvent): Promise<void>
}
