import { Role } from '../value-objects/Role'

/**
 * Domain event types for the auth module.
 *
 * These are defined as plain types in the domain layer.
 * Currently dispatched synchronously; designed to be migrated to an
 * async event bus (RabbitMQ, Kafka) without changing domain logic.
 */

export interface DomainEvent {
  readonly occurredAt: Date
  readonly eventId: string
}

export interface UserRegistered extends DomainEvent {
  readonly type: 'UserRegistered'
  readonly userId: string
  readonly email: string
  readonly role: Role
  readonly createdBy: string | null
}

export interface PasswordChanged extends DomainEvent {
  readonly type: 'PasswordChanged'
  readonly userId: string
  readonly email: string
  readonly initiatedBy: 'user' | 'admin' | 'reset'
}

export interface AccountLocked extends DomainEvent {
  readonly type: 'AccountLocked'
  readonly accountKey: string
  readonly reason: 'failed_attempts'
  readonly lockDurationSeconds: number
}

export type AuthDomainEvent = UserRegistered | PasswordChanged | AccountLocked
