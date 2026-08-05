import { ICreateAthleteUseCase } from '../../application/use-cases/CreateAthleteUseCase'
import { ICreateUserByAdminUseCase } from '../../application/use-cases/CreateUserByAdminUseCase'

/**
 * UserController — handles user management routes.
 *
 * Routes:
 *   POST  /users              → Create user (Admin creates Admin/Coach; Coach creates Athlete)
 *   PATCH /users/:id/role     → Modify user role (Admin only)
 *
 * Full HTTP wiring implemented in Task 14.
 */
export class UserController {
  constructor(
    private readonly createUserByAdminUseCase: ICreateUserByAdminUseCase,
    private readonly createAthleteUseCase: ICreateAthleteUseCase
  ) {}

  // Stub — full implementation in Task 14
  async createUser(_req: unknown, _res: unknown): Promise<void> {
    throw new Error('Not implemented yet — see Task 14')
  }

  async assignRole(_req: unknown, _res: unknown): Promise<void> {
    throw new Error('Not implemented yet — see Task 14')
  }
}
