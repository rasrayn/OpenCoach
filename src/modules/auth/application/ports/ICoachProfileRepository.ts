/** Persistence port for the optional profile attached to a coach account. */
export interface CoachProfileData {
  userId: string
  gymName?: string
  program?: string
}

export interface ICoachProfileRepository {
  save(profile: CoachProfileData): Promise<void>
}
