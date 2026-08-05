import { AccessTokenResult } from '../dtos'

/**
 * RefreshTokenUseCase — handles access token refresh via a valid refresh token.
 * Implementation to be added in a later task.
 */
export interface IRefreshTokenUseCase {
  execute(refreshToken: string): Promise<AccessTokenResult>
}
