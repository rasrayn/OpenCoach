export class RoleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

export class InvalidRoleError extends RoleError {
  constructor(role: string) {
    super(`Invalid role: ${role}`)
  }
}

export class UserNotFoundError extends RoleError {
  constructor(userId: string) {
    super(`User not found: ${userId}`)
  }
}

export class InsufficientRoleError extends RoleError {
  constructor(requiredRole: string) {
    super(`User does not have required role: ${requiredRole}`)
  }
}

export class RoleAssignmentForbiddenError extends RoleError {
  constructor() {
    super('Only administrators can assign roles')
  }
}
