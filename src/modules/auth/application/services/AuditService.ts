import { AuditEvent } from '../dtos'
import { IAuditRepository } from '../ports/IAuditRepository'
import { IAuditService } from '../ports/IAuditService'

/**
 * AuditService ensures every persisted security event carries the required
 * audit fields and an UTC timestamp.
 */
export class AuditService implements IAuditService {
  constructor(private readonly auditRepository: IAuditRepository) {}

  async log(event: AuditEvent): Promise<void> {
    this.assertRequiredFields(event)

    await this.auditRepository.save({
      ...event,
      occurredAt: new Date(event.occurredAt.toISOString()),
    })
  }

  private assertRequiredFields(event: AuditEvent): void {
    if (event.userId === undefined) {
      throw new Error('Audit event requires userId')
    }

    if (!event.eventType) {
      throw new Error('Audit event requires eventType')
    }

    if (!(event.occurredAt instanceof Date) || Number.isNaN(event.occurredAt.getTime())) {
      throw new Error('Audit event requires a valid occurredAt')
    }

    if (!event.ipAddress) {
      throw new Error('Audit event requires ipAddress')
    }

    if (event.deviceInfo === undefined) {
      throw new Error('Audit event requires deviceInfo')
    }
  }
}
