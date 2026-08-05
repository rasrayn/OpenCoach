import { CoachRegistrationData, UserSummary } from '../dtos'

/**
 * RegisterCoachUseCase — handles public coach self-registration.
 * Implementation to be added in a later task.
 */
export interface IRegisterCoachUseCase {
  execute(data: CoachRegistrationData): Promise<UserSummary>
}
