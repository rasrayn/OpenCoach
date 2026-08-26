import { Role } from '../../domain/value-objects/Role'

export class RoleError extends Error {
  constructor(message: string) {
    super(message)
    this.name = new.target.name
  }
}

export class InvalidRoleError extends RoleError {
  constructor(public readonly role: string) {
    super(`Invalid role: ${role}`)
  }
}

export class InsufficientRoleError extends RoleError {
  constructor(public readonly requiredRole: Role) {
    super(`User does not have required role: ${requiredRole}`)
  }
}

export class RoleAssignmentForbiddenError extends RoleError {
  constructor(
    public readonly requesterRole: Role,
    public readonly targetRole: Role
  ) {
    super(`Role assignment forbidden: ${requesterRole} cannot assign ${targetRole}`)
  }
}
