import { createHash, randomBytes } from 'crypto'
import { RefreshToken, DeviceInfo } from '../../domain/entities/RefreshToken'
import { ITokenRepository } from '../../domain/repositories/ITokenRepository'
import { IUserRepository } from '../../domain/repositories/IUserRepository'
import { ITokenSigner } from '../../domain/services/ITokenSigner'
import { Role } from '../../domain/value-objects/Role'
import { TokenPayload } from '../dtos'
import {
  RefreshTokenAlreadyConsumedError,
  RefreshTokenExpiredError,
  RefreshTokenNotFoundError,
  RefreshTokenRevokedError,
  RefreshTokenUserNotFoundError,
} from '../errors'
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
    private readonly userRepository: IUserRepository,
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
    deviceInfo?: DeviceInfo
  ): Promise<IssuedRefreshToken> {
    await this.tokenRepository.revokeActiveRefreshTokensForDevice(userId, deviceId)

    const plainToken = this.generateOpaqueToken()
    const record = await this.tokenRepository.saveRefreshToken({
      userId,
      tokenHash: hashToken(plainToken),
      deviceId,
      deviceInfo: deviceInfo ?? null,
      role,
      expiresAt: this.calculateRefreshTokenExpiry(role),
      revokedAt: null,
    })

    return { plainToken, record }
  }

  async verifyAndConsumeRefreshToken(token: string): Promise<ConsumedRefreshToken> {
    const tokenHash = hashToken(token)
    const record = await this.tokenRepository.findRefreshTokenByHash(tokenHash)
    if (!record) {
      throw new RefreshTokenNotFoundError()
    }

    if (record.revokedAt) {
      throw new RefreshTokenRevokedError()
    }

    if (this.isRefreshTokenExpired(record)) {
      throw new RefreshTokenExpiredError()
    }

    const currentUser = await this.userRepository.findById(record.userId)
    if (!currentUser) {
      throw new RefreshTokenUserNotFoundError()
    }

    const plainToken = this.generateOpaqueToken()
    const rotated = await this.tokenRepository.rotateRefreshToken({
      consumedTokenId: record.id,
      consumedTokenHash: tokenHash,
      newToken: {
        userId: record.userId,
        tokenHash: hashToken(plainToken),
        deviceId: record.deviceId,
        deviceInfo: record.deviceInfo,
        role: currentUser.role,
        expiresAt: this.calculateRefreshTokenExpiry(currentUser.role),
        revokedAt: null,
      },
    })

    if (!rotated) {
      throw new RefreshTokenAlreadyConsumedError()
    }

    return {
      consumedToken: rotated.consumedToken,
      rotatedToken: {
        plainToken,
        record: rotated.rotatedToken,
      },
      currentUser,
    }
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