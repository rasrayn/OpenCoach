export abstract class RefreshTokenError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

export class RefreshTokenNotFoundError extends RefreshTokenError {
  constructor() {
    super('Refresh token not found')
  }
}

export class RefreshTokenRevokedError extends RefreshTokenError {
  constructor() {
    super('Refresh token revoked')
  }
}

export class RefreshTokenExpiredError extends RefreshTokenError {
  constructor() {
    super('Refresh token expired')
  }
}

export class RefreshTokenAlreadyConsumedError extends RefreshTokenError {
  constructor() {
    super('Refresh token already consumed')
  }
}

export class RefreshTokenUserNotFoundError extends RefreshTokenError {
  constructor() {
    super('Refresh token user not found')
  }
}