/**
 * Base domain error types shared across all modules.
 */

export class DomainError extends Error {
  constructor(message: string) {
    super(message)
    this.name = this.constructor.name
    Object.setPrototypeOf(this, new.target.prototype)
  }
}

export class NotFoundError extends DomainError {
  constructor(resource: string, id?: string) {
    super(id ? `${resource} with id '${id}' not found` : `${resource} not found`)
  }
}

export class ConflictError extends DomainError {
  constructor(message: string) {
    super(message)
  }
}

export class UnauthorizedError extends DomainError {
  constructor(message = 'Unauthorized') {
    super(message)
  }
}

export class ForbiddenError extends DomainError {
  constructor(message = 'Forbidden') {
    super(message)
  }
}

export class ValidationError extends DomainError {
  constructor(
    message: string,
    public readonly errors: string[] = []
  ) {
    super(message)
  }
}

export class TokenExpiredError extends DomainError {
  constructor(message = 'Token has expired') {
    super(message)
  }
}

export class TokenAlreadyUsedError extends DomainError {
  constructor(message = 'Token has already been used') {
    super(message)
  }
}

export class RateLimitError extends DomainError {
  constructor(
    message: string,
    public readonly remainingSeconds?: number
  ) {
    super(message)
  }
}
