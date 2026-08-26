import { RefreshToken, DeviceInfo } from '../../domain/entities/RefreshToken'
import { User } from '../../domain/entities/User'
import { Role } from '../../domain/value-objects/Role'
import { TokenPayload } from '../dtos'

export interface IssuedRefreshToken {
  plainToken: string
  record: RefreshToken
}

export interface ConsumedRefreshToken {
  consumedToken: RefreshToken
  rotatedToken: IssuedRefreshToken
  currentUser: User
}

export interface ITokenService {
  issueAccessToken(payload: Omit<TokenPayload, 'iat' | 'exp' | 'jti'>): string

  verifyAccessToken(token: string): TokenPayload

  issueRefreshToken(
    userId: string,
    deviceId: string,
    role: Role,
    deviceInfo?: DeviceInfo
  ): Promise<IssuedRefreshToken>

  verifyAndConsumeRefreshToken(token: string): Promise<ConsumedRefreshToken>

  revokeRefreshToken(tokenId: string): Promise<void>

  revokeAllUserRefreshTokens(userId: string): Promise<void>
}