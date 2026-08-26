import { IUserRepository } from '../../domain/repositories/IUserRepository'
import { Role, isValidRole } from '../../domain/value-objects/Role'
import {
  InsufficientRoleError,
  InvalidRoleError,
  RoleAssignmentForbiddenError,
  UserNotFoundError,
} from '../errors'
import { IRoleService } from '../ports/IRoleService'

export class RoleService implements IRoleService {
  async assignRole(targetUserId: string, newRole: Role, requesterId: string): Promise<void> {
    this.assertRole(newRole)

    const requester = await this.userRepository.findById(requesterId)
    if (!requester) {
      throw new UserNotFoundError(requesterId)
    }

    if (requester.role !== Role.ADMIN) {
      throw new RoleAssignmentForbiddenError()
    }

    const targetUser = await this.userRepository.findById(targetUserId)
    if (!targetUser) {
      throw new UserNotFoundError(targetUserId)
    }

    await this.userRepository.update(targetUserId, { role: newRole })
  }

  async validatePermission(userId: string, requiredRole: Role): Promise<boolean> {
    this.assertRole(requiredRole)

    const user = await this.userRepository.findById(userId)
    if (!user) {
      throw new UserNotFoundError(userId)
    }

    if (user.role !== requiredRole) {
      throw new InsufficientRoleError(requiredRole)
    }

    return true
  }

  canCreateRole(requesterRole: Role | null, targetRole: Role): boolean {
    this.assertRole(targetRole)

    if (requesterRole !== null) {
      this.assertRole(requesterRole)
    }

    if (requesterRole === null) {
      return targetRole === Role.COACH
    }

    switch (requesterRole) {
      case Role.ADMIN:
        return targetRole === Role.ADMIN || targetRole === Role.COACH
      case Role.COACH:
        return targetRole === Role.ATHLETE
      case Role.ATHLETE:
        return false
    }
  }

  constructor(private readonly userRepository: IUserRepository) {}

  private assertRole(role: string): asserts role is Role {
    if (!isValidRole(role)) {
      throw new InvalidRoleError(role)
    }
  }
}
