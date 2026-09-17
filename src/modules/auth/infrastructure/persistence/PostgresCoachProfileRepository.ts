import { ICoachProfileRepository, CoachProfileData } from '../../application/ports/ICoachProfileRepository'
import { DbPool } from './PostgresUserRepository'

export class PostgresCoachProfileRepository implements ICoachProfileRepository {
  constructor(private readonly pool: DbPool) {}

  async save(profile: CoachProfileData): Promise<void> {
    await this.pool.query(
      `INSERT INTO coach_profiles (user_id, gym_name, program) VALUES ($1, $2, $3)`,
      [profile.userId, profile.gymName ?? null, profile.program ?? null],
    )
  }
}
