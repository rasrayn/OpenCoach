import { Role } from '../../domain/value-objects/Role'

export interface IRoleService {
  assignRole(targetUserId: string, newRole: Role, requesterId: string): Promise<void>
  assertPermission(userId: string, requiredRole: Role): Promise<void>
  canAssignRole(requesterRole: Role, targetRole: Role): boolean
  canChangeRole(requesterRole: Role, currentRole: Role, newRole: Role): boolean
  canCreateRole(requesterRole: Role | null, targetRole: Role): boolean
}
