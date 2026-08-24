import * as fc from 'fast-check'
import { AuditEvent, AuditEventType } from '../../dtos'
import { IAuditRepository } from '../../ports/IAuditRepository'
import { AuditService } from '../AuditService'
import { PostgresAuditRepository } from '../../../infrastructure/persistence/PostgresAuditRepository'
import { DbPool } from '../../../infrastructure/persistence/PostgresUserRepository'

const auditEventTypes: AuditEventType[] = [
  'AUTH_SUCCESS',
  'AUTH_FAILURE',
  'LOGOUT',
  'PASSWORD_CHANGE',
  'PASSWORD_RESET',
  'ACCOUNT_CREATED',
  'ROLE_CHANGED',
  'ACCOUNT_LOCKED',
  'EMAIL_VERIFIED',
]

const ipAddressArb = fc
  .tuple(
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 }),
    fc.integer({ min: 0, max: 255 })
  )
  .map((octets) => octets.join('.'))

const deviceInfoArb: fc.Arbitrary<AuditEvent['deviceInfo']> = fc.oneof(
  fc.constant(null),
  fc.record({
    deviceId: fc.option(fc.string({ minLength: 1, maxLength: 64 }), { nil: undefined }),
    deviceType: fc.option(
      fc.constantFrom<'WEB' | 'IOS' | 'ANDROID' | 'DESKTOP'>('WEB', 'IOS', 'ANDROID', 'DESKTOP'),
      { nil: undefined }
    ),
    userAgent: fc.option(fc.string({ minLength: 1, maxLength: 128 }), { nil: undefined }),
  })
)

const auditEventArb: fc.Arbitrary<AuditEvent> = fc.record({
  userId: fc.oneof(fc.uuid(), fc.constant(null)),
  eventType: fc.constantFrom(...auditEventTypes),
  occurredAt: fc.date({
    min: new Date('2000-01-01T00:00:00.000Z'),
    max: new Date('2100-01-01T00:00:00.000Z'),
  }),
  ipAddress: ipAddressArb,
  deviceInfo: deviceInfoArb,
  metadata: fc.option(fc.dictionary(fc.string({ minLength: 1, maxLength: 20 }), fc.string()), {
    nil: undefined,
  }),
})

describe('AuditService.log - property tests (Propiedad 8)', () => {
  it('persists all required audit fields for every event type', async () => {
    await fc.assert(
      fc.asyncProperty(auditEventArb, async (event) => {
        const savedEvents: AuditEvent[] = []
        const repository: IAuditRepository = {
          save: async (savedEvent) => {
            savedEvents.push(savedEvent)
          },
        }

        const service = new AuditService(repository)
        await service.log(event)

        expect(savedEvents).toHaveLength(1)
        expect(savedEvents[0]).toEqual(
          expect.objectContaining({
            userId: event.userId,
            eventType: event.eventType,
            ipAddress: event.ipAddress,
            deviceInfo: event.deviceInfo,
          })
        )
        expect(savedEvents[0].occurredAt).toBeInstanceOf(Date)
        expect(savedEvents[0].occurredAt.toISOString()).toMatch(/Z$/)
      }),
      { numRuns: 200 }
    )
  })

  it.each(auditEventTypes)('covers audit event type %s', async (eventType) => {
    const savedEvents: AuditEvent[] = []
    const service = new AuditService({
      save: async (savedEvent) => {
        savedEvents.push(savedEvent)
      },
    })

    await service.log({
      userId: '00000000-0000-4000-8000-000000000001',
      eventType,
      occurredAt: new Date('2026-08-24T10:00:00.000Z'),
      ipAddress: '127.0.0.1',
      deviceInfo: { deviceId: 'test-device', deviceType: 'WEB', userAgent: 'jest' },
    })

    expect(savedEvents[0].eventType).toBe(eventType)
  })
})

describe('PostgresAuditRepository.save', () => {
  it('inserts all required audit fields into audit_logs', async () => {
    const calls: Array<{ text: string; values?: unknown[] }> = []
    const pool: DbPool = {
      query: async (text, values) => {
        calls.push({ text, values })
        return { rows: [], rowCount: 1 }
      },
    }

    const repository = new PostgresAuditRepository(pool)
    await repository.save({
      userId: '00000000-0000-4000-8000-000000000001',
      eventType: 'AUTH_SUCCESS',
      occurredAt: new Date('2026-08-24T10:00:00.000Z'),
      ipAddress: '127.0.0.1',
      deviceInfo: { deviceId: 'web-1', deviceType: 'WEB', userAgent: 'jest' },
      metadata: { reason: 'test' },
    })

    expect(calls).toHaveLength(1)
    expect(calls[0].text).toContain('INSERT INTO audit_logs')
    expect(calls[0].text).toContain('user_id, event_type, occurred_at, ip_address, device_info, metadata')
    expect(calls[0].values).toEqual([
      '00000000-0000-4000-8000-000000000001',
      'AUTH_SUCCESS',
      '2026-08-24T10:00:00.000Z',
      '127.0.0.1',
      JSON.stringify({ deviceId: 'web-1', deviceType: 'WEB', userAgent: 'jest' }),
      JSON.stringify({ reason: 'test' }),
    ])
  })
})
