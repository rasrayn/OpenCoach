import { RefreshToken } from '../entities/RefreshToken'
import { EmailVerificationToken } from '../entities/EmailVerificationToken'
import { PasswordResetToken } from '../entities/PasswordResetToken'

export interface RefreshTokenRotationInput {
  consumedTokenId: string
  consumedTokenHash: string
  newToken: Omit<RefreshToken, 'id' | 'issuedAt'>
}

export interface RefreshTokenRotationResult {
  consumedToken: RefreshToken
  rotatedToken: RefreshToken
}

/**
 * ITokenRepository - pure domain interface for all token types.
 * Implementations live in the infrastructure layer.
 */
export interface ITokenRepository {
  // Refresh Tokens

  saveRefreshToken(
    token: Omit<RefreshToken, 'id' | 'issuedAt'>
  ): Promise<RefreshToken>

  findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null>

  rotateRefreshToken(
    input: RefreshTokenRotationInput
  ): Promise<RefreshTokenRotationResult | null>

  revokeRefreshToken(tokenId: string): Promise<void>

  revokeActiveRefreshTokensForDevice(userId: string, deviceId: string): Promise<void>

  revokeAllRefreshTokensForUser(userId: string): Promise<void>

  findActiveRefreshTokensByUser(userId: string): Promise<RefreshToken[]>

  // Email Verification Tokens

  saveEmailVerificationToken(
    token: Omit<EmailVerificationToken, 'id' | 'issuedAt'>
  ): Promise<EmailVerificationToken>

  findEmailVerificationTokenByHash(
    tokenHash: string
  ): Promise<EmailVerificationToken | null>

  markEmailVerificationTokenUsed(tokenId: string): Promise<void>

  invalidatePreviousEmailVerificationTokens(userId: string): Promise<void>

  // Password Reset Tokens

  savePasswordResetToken(
    token: Omit<PasswordResetToken, 'id' | 'issuedAt'>
  ): Promise<PasswordResetToken>

  findPasswordResetTokenByHash(
    tokenHash: string
  ): Promise<PasswordResetToken | null>

  markPasswordResetTokenUsed(tokenId: string): Promise<void>
}