import { AuditEvent } from '../dtos'

/**
 * IAuditService — application port for security event logging.
 * Concrete implementation lives in infrastructure/persistence/.
 */
export interface IAuditService {
  /**
   * Persists a security audit event with all required fields.
   */
  log(event: AuditEvent): Promise<void>
}
