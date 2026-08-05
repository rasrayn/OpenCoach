import { CoachCreateAthleteData, UserSummary } from '../dtos'

/**
 * CreateAthleteUseCase — handles athlete account creation by a coach.
 * Implementation to be added in a later task.
 */
export interface ICreateAthleteUseCase {
  execute(data: CoachCreateAthleteData, coachId: string): Promise<UserSummary>
}
