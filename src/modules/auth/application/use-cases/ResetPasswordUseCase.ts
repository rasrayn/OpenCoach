import { ResetPasswordData } from '../dtos'

/**
 * ResetPasswordUseCase — handles password reset via a valid reset token.
 * Implementation to be added in a later task.
 */
export interface IResetPasswordUseCase {
  execute(data: ResetPasswordData): Promise<void>
}
