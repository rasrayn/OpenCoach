import { ILoginUseCase } from '../../application/use-cases/LoginUseCase'
import { IRegisterCoachUseCase } from '../../application/use-cases/RegisterCoachUseCase'
import { IRefreshTokenUseCase } from '../../application/use-cases/RefreshTokenUseCase'
import { IChangePasswordUseCase } from '../../application/use-cases/ChangePasswordUseCase'
import { IResetPasswordUseCase } from '../../application/use-cases/ResetPasswordUseCase'
import { IVerifyEmailUseCase } from '../../application/use-cases/VerifyEmailUseCase'
import { IRevokeSessionsUseCase } from '../../application/use-cases/RevokeSessionsUseCase'

/**
 * AuthController — handles all authentication-related HTTP routes.
 *
 * Routes:
 *   POST /auth/register                    → Public coach registration
 *   POST /auth/login                       → Authenticate with credentials
 *   POST /auth/logout                      → Revoke session token
 *   POST /auth/token/refresh               → Refresh access token
 *   POST /auth/password/change             → Change password (authenticated)
 *   POST /auth/password/forgot             → Request password recovery
 *   POST /auth/password/reset              → Apply new password with reset token
 *   GET  /auth/email/verify/:token         → Verify email address
 *   POST /auth/email/resend-verification   → Resend verification email
 *   DELETE /auth/sessions                  → Revoke all sessions for current user
 *
 * Full HTTP wiring implemented in Task 14.
 */
export class AuthController {
  constructor(
    private readonly loginUseCase: ILoginUseCase,
    private readonly registerCoachUseCase: IRegisterCoachUseCase,
    private readonly refreshTokenUseCase: IRefreshTokenUseCase,
    private readonly changePasswordUseCase: IChangePasswordUseCase,
    private readonly resetPasswordUseCase: IResetPasswordUseCase,
    private readonly verifyEmailUseCase: IVerifyEmailUseCase,
    private readonly revokeSessionsUseCase: IRevokeSessionsUseCase
  ) {}

  // Stub — full implementation in Task 14
  async register(_req: unknown, _res: unknown): Promise<void> {
    throw new Error('Not implemented yet — see Task 14')
  }

  async login(_req: unknown, _res: unknown): Promise<void> {
    throw new Error('Not implemented yet — see Task 14')
  }

  async logout(_req: unknown, _res: unknown): Promise<void> {
    throw new Error('Not implemented yet — see Task 14')
  }

  async refreshToken(_req: unknown, _res: unknown): Promise<void> {
    throw new Error('Not implemented yet — see Task 14')
  }

  async changePassword(_req: unknown, _res: unknown): Promise<void> {
    throw new Error('Not implemented yet — see Task 14')
  }

  async forgotPassword(_req: unknown, _res: unknown): Promise<void> {
    throw new Error('Not implemented yet — see Task 14')
  }

  async resetPassword(_req: unknown, _res: unknown): Promise<void> {
    throw new Error('Not implemented yet — see Task 14')
  }

  async verifyEmail(_req: unknown, _res: unknown): Promise<void> {
    throw new Error('Not implemented yet — see Task 14')
  }

  async resendVerification(_req: unknown, _res: unknown): Promise<void> {
    throw new Error('Not implemented yet — see Task 14')
  }

  async revokeSessions(_req: unknown, _res: unknown): Promise<void> {
    throw new Error('Not implemented yet — see Task 14')
  }
}
