import { Role } from '../../domain/value-objects/Role'

/**
 * RoleGuard — middleware that restricts access to routes by role.
 * Full implementation added in Task 14.
 */
export class RoleGuard {
  static require(_role: Role): void {
    // Middleware factory — implementation in Task 14
  }
}
