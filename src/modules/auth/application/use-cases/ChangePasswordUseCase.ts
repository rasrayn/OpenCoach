import { ChangePasswordData } from '../dtos'

/**
 * ChangePasswordUseCase — handles password change for authenticated users.
 * Implementation to be added in a later task.
 */
export interface IChangePasswordUseCase {
  execute(data: ChangePasswordData): Promise<void>
}
