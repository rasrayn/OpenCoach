import { createHash, randomBytes } from 'crypto'
import { RefreshToken, DeviceInfo } from '../../domain/entities/RefreshToken'
import { ITokenRepository } from '../../domain/repositories/ITokenRepository'
import { ITokenSigner } from '../../domain/services/ITokenSigner'
import { Role } from '../../domain/value-objects/Role'
import { TokenPayload } from '../dtos'
import {
  ConsumedRefreshToken,
  IssuedRefreshToken,
  ITokenService,
} from '../ports/ITokenService'

export interface TokenServiceOptions {
  now?: () => Date
  generateOpaqueToken?: () => string
}

export class TokenService implements ITokenService {
  static readonly ACCESS_TOKEN_EXPIRES_IN_SECONDS = 900
  static readonly ADMIN_REFRESH_TOKEN_DAYS = 1
  static readonly COACH_REFRESH_TOKEN_DAYS = 7

  private readonly now: () => Date
  private readonly generateOpaqueToken: () => string

  constructor(
    private readonly tokenSigner: ITokenSigner,
    private readonly tokenRepository: ITokenRepository,
    options: TokenServiceOptions = {}
  ) {
    this.now = options.now ?? (() => new Date())
    this.generateOpaqueToken =
      options.generateOpaqueToken ?? (() => randomBytes(32).toString('base64url'))
  }

  issueAccessToken(payload: Omit<TokenPayload, 'iat' | 'exp' | 'jti'>): string {
    return this.tokenSigner.sign(payload)
  }

  verifyAccessToken(token: string): TokenPayload {
    return this.tokenSigner.verify(token)
  }

  async issueRefreshToken(
    userId: string,
    deviceId: string,
    role: Role,
    deviceInfo: DeviceInfo | null = null
  ): Promise<IssuedRefreshToken> {
    const plainToken = this.generateOpaqueToken()
    const record = await this.tokenRepository.saveRefreshToken({
      userId,
      tokenHash: hashToken(plainToken),
      deviceId,
      deviceInfo,
      role,
      expiresAt: this.calculateRefreshTokenExpiry(role),
      revokedAt: null,
    })

    return { plainToken, record }
  }

  async verifyAndConsumeRefreshToken(token: string): Promise<ConsumedRefreshToken> {
    const record = await this.tokenRepository.findRefreshTokenByHash(hashToken(token))
    if (!record) {
      throw new Error('Refresh token not found')
    }

    if (record.revokedAt) {
      throw new Error('Refresh token revoked')
    }

    if (this.isRefreshTokenExpired(record)) {
      throw new Error('Refresh token expired')
    }

    await this.tokenRepository.revokeRefreshToken(record.id)
    const rotatedToken = await this.issueRefreshToken(
      record.userId,
      record.deviceId,
      record.role,
      record.deviceInfo
    )

    return { consumedToken: record, rotatedToken }
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    await this.tokenRepository.revokeRefreshToken(tokenId)
  }

  async revokeAllUserRefreshTokens(userId: string): Promise<void> {
    await this.tokenRepository.revokeAllRefreshTokensForUser(userId)
  }

  private calculateRefreshTokenExpiry(role: Role): Date | null {
    if (role === Role.ATHLETE) {
      return null
    }

    const days =
      role === Role.ADMIN
        ? TokenService.ADMIN_REFRESH_TOKEN_DAYS
        : TokenService.COACH_REFRESH_TOKEN_DAYS

    return new Date(this.now().getTime() + days * 24 * 60 * 60 * 1000)
  }

  private isRefreshTokenExpired(token: RefreshToken): boolean {
    return token.expiresAt !== null && token.expiresAt.getTime() <= this.now().getTime()
  }
}

export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}
