import { DomainError } from '../../../../shared/domain/errors'

/** Never include SMTP responses, message bodies, credentials or tokens. */
export class EmailDeliveryError extends DomainError {
  constructor() { super('Email delivery failed') }
}

export class EmailDeliveryTimeoutError extends EmailDeliveryError {}
