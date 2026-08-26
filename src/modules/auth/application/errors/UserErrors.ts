export class UserError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

export class UserNotFoundError extends UserError {
  constructor(public readonly userId: string) {
    super(`User not found: ${userId}`)
  }
}
