import { Role } from '../../domain/value-objects/Role'

export interface IRoleService {
  assignRole(targetUserId: string, newRole: Role, requesterId: string): Promise<void>
  validatePermission(userId: string, requiredRole: Role): Promise<boolean>
  canCreateRole(requesterRole: Role | null, targetRole: Role): boolean
}
