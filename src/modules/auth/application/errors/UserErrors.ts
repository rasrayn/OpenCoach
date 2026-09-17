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

export class UserEmailAlreadyExistsError extends UserError {
  constructor(public readonly email: string) {
    super(`Email already in use: ${email}`)
  }
}

export class UserCreationForbiddenError extends UserError {
  constructor(public readonly requesterRole: string, public readonly targetRole: string) {
    super(`User creation forbidden: ${requesterRole} cannot create ${targetRole}`)
  }
}

export class InvalidUserCreationRoleError extends UserError {
  constructor(public readonly role: string) {
    super(`Invalid user creation role: ${role}`)
  }
}
