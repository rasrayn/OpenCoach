import { AdminCreateUserData, UserSummary } from '../dtos'

/**
 * CreateUserByAdminUseCase — handles user account creation by an admin.
 * Implementation to be added in a later task.
 */
export interface ICreateUserByAdminUseCase {
  execute(data: AdminCreateUserData, adminId: string): Promise<UserSummary>
}
