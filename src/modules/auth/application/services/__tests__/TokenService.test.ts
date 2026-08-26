import * as fc from 'fast-check'
import { EmailVerificationToken } from '../../../domain/entities/EmailVerificationToken'
import { PasswordResetToken } from '../../../domain/entities/PasswordResetToken'
import { RefreshToken } from '../../../domain/entities/RefreshToken'
import { User } from '../../../domain/entities/User'
import { ITokenRepository } from '../../../domain/repositories/ITokenRepository'
import { IUserRepository } from '../../../domain/repositories/IUserRepository'
import { ITokenSigner } from '../../../domain/services/ITokenSigner'
import { Role } from '../../../domain/value-objects/Role'
import { TokenPayload } from '../../dtos'
import {
  RefreshTokenAlreadyConsumedError,
  RefreshTokenExpiredError,
  RefreshTokenNotFoundError,
  RefreshTokenRevokedError,
  RefreshTokenUserNotFoundError,
} from '../../errors'
import { TokenService, hashToken } from '../TokenService'

const now = new Date('2026-08-25T10:00:00.000Z')

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'coach@example.com',
    passwordHash: 'hash',
    role: Role.COACH,
    emailVerified: true,
    isFirstAccess: false,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

class InMemoryUserRepository implements IUserRepository {
  constructor(private user: User | null = createUser()) {}

  setUser(user: User | null): void {
    this.user = user
  }

  async findById(id: string): Promise<User | null> {
    return this.user?.id === id ? this.user : null
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.user?.email === email ? this.user : null
  }

  async save(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    this.user = { ...user, id: 'user-1', createdAt: now, updatedAt: now }
    return this.user
  }

  async update(
    id: string,
    updates: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<User> {
    if (!this.user || this.user.id !== id) throw new Error('User not found')
    this.user = { ...this.user, ...updates, updatedAt: now }
    return this.user
  }

  async delete(id: string): Promise<void> {
    if (this.user?.id === id) this.user = null
  }
}

class InMemoryTokenRepository implements ITokenRepository {
  readonly refreshTokens: RefreshToken[] = []
  readonly revokedTokenIds: string[] = []
  forceNextRotateResult: boolean | null = null
  private nextId = 1

  async saveRefreshToken(token: Omit<RefreshToken, 'id' | 'issuedAt'>): Promise<RefreshToken> {
    const saved: RefreshToken = {
      ...token,
      id: `refresh-token-${this.nextId++}`,
      issuedAt: now,
    }

    this.refreshTokens.push(saved)
    return saved
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.refreshTokens.find((token) => token.tokenHash === tokenHash) ?? null
  }

  async rotateRefreshToken(input: {
    consumedTokenId: string
    consumedTokenHash: string
    newToken: Omit<RefreshToken, 'id' | 'issuedAt'>
  }): Promise<{ consumedToken: RefreshToken; rotatedToken: RefreshToken } | null> {
    if (this.forceNextRotateResult !== null) {
      const result = this.forceNextRotateResult
      this.forceNextRotateResult = null
      return result ? this.rotate(input) : null
    }

    return this.rotate(input)
  }

  private async rotate(input: {
    consumedTokenId: string
    consumedTokenHash: string
    newToken: Omit<RefreshToken, 'id' | 'issuedAt'>
  }): Promise<{ consumedToken: RefreshToken; rotatedToken: RefreshToken } | null> {
    const token = this.refreshTokens.find(
      (current) =>
        current.id === input.consumedTokenId && current.tokenHash === input.consumedTokenHash
    )
    if (!token || token.revokedAt !== null || (token.expiresAt !== null && token.expiresAt <= now)) {
      return null
    }

    token.revokedAt = now
    this.revokedTokenIds.push(token.id)
    const rotatedToken = await this.saveRefreshToken(input.newToken)

    return { consumedToken: token, rotatedToken }
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    const token = this.refreshTokens.find((current) => current.id === tokenId)
    if (token && token.revokedAt === null) {
      token.revokedAt = now
      this.revokedTokenIds.push(token.id)
    }
  }

  async revokeActiveRefreshTokensForDevice(userId: string, deviceId: string): Promise<void> {
    this.refreshTokens
      .filter(
        (token) =>
          token.userId === userId && token.deviceId === deviceId && token.revokedAt === null
      )
      .forEach((token) => {
        token.revokedAt = now
        this.revokedTokenIds.push(token.id)
      })
  }

  async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    this.refreshTokens
      .filter((token) => token.userId === userId && token.revokedAt === null)
      .forEach((token) => {
        token.revokedAt = now
        this.revokedTokenIds.push(token.id)
      })
  }

  async findActiveRefreshTokensByUser(userId: string): Promise<RefreshToken[]> {
    return this.refreshTokens.filter((token) => token.userId === userId && token.revokedAt === null)
  }

  async saveEmailVerificationToken(
    _token: Omit<EmailVerificationToken, 'id' | 'issuedAt'>
  ): Promise<EmailVerificationToken> {
    throw new Error('Not used in TokenService tests')
  }

  async findEmailVerificationTokenByHash(_tokenHash: string): Promise<EmailVerificationToken | null> {
    throw new Error('Not used in TokenService tests')
  }

  async markEmailVerificationTokenUsed(_tokenId: string): Promise<void> {
    throw new Error('Not used in TokenService tests')
  }

  async invalidatePreviousEmailVerificationTokens(_userId: string): Promise<void> {
    throw new Error('Not used in TokenService tests')
  }

  async savePasswordResetToken(
    _token: Omit<PasswordResetToken, 'id' | 'issuedAt'>
  ): Promise<PasswordResetToken> {
    throw new Error('Not used in TokenService tests')
  }

  async findPasswordResetTokenByHash(_tokenHash: string): Promise<PasswordResetToken | null> {
    throw new Error('Not used in TokenService tests')
  }

  async markPasswordResetTokenUsed(_tokenId: string): Promise<void> {
    throw new Error('Not used in TokenService tests')
  }
}

class FakeTokenSigner implements ITokenSigner {
  sign(payload: Omit<TokenPayload, 'iat' | 'exp' | 'jti'>): string {
    return JSON.stringify({ ...payload, iat: 1, exp: 901, jti: 'fake-jti' })
  }

  verify(token: string): TokenPayload {
    return JSON.parse(token) as TokenPayload
  }
}

function createService(
  repository = new InMemoryTokenRepository(),
  tokens = ['opaque-refresh-token'],
  userRepository = new InMemoryUserRepository()
) {
  let nextToken = 0
  return {
    repository,
    userRepository,
    service: new TokenService(new FakeTokenSigner(), repository, userRepository, {
      now: () => now,
      generateOpaqueToken: () => tokens[nextToken++] ?? `opaque-refresh-token-${nextToken}`,
    }),
  }
}

describe('TokenService - refresh tokens (Propiedad 5)', () => {
  it('assigns refresh token expiration from role and never stores the plain token', async () => {
    await fc.assert(
      fc.asyncProperty(fc.constantFrom(Role.ADMIN, Role.COACH, Role.ATHLETE), async (role) => {
        const { service, repository } = createService(undefined, [`opaque-${role}`])

        const issued = await service.issueRefreshToken('user-1', 'device-1', role)

        expect(issued.plainToken).toBe(`opaque-${role}`)
        expect(repository.refreshTokens[0].tokenHash).toBe(hashToken(`opaque-${role}`))
        expect(repository.refreshTokens[0].tokenHash).not.toBe(`opaque-${role}`)

        if (role === Role.ATHLETE) {
          expect(issued.record.expiresAt).toBeNull()
        } else {
          const expectedDays = role === Role.ADMIN ? 1 : 7
          expect(issued.record.expiresAt?.getTime()).toBe(
            now.getTime() + expectedDays * 24 * 60 * 60 * 1000
          )
        }
      }),
      { numRuns: 60 }
    )
  })
})

describe('TokenService - refresh rotation (Propiedad 16)', () => {
  it('rotates a valid refresh token and revokes only the consumed historical record', async () => {
    const { service, repository } = createService(undefined, ['first-token', 'rotated-token'])
    const issued = await service.issueRefreshToken('user-1', 'device-1', Role.COACH)

    const consumed = await service.verifyAndConsumeRefreshToken(issued.plainToken)

    expect(consumed.consumedToken.id).toBe(issued.record.id)
    expect(repository.revokedTokenIds).toEqual([issued.record.id])
    expect(consumed.rotatedToken.plainToken).toBe('rotated-token')
    expect(consumed.rotatedToken.record.id).not.toBe(issued.record.id)
    expect(consumed.rotatedToken.record.tokenHash).toBe(hashToken('rotated-token'))
    expect(repository.refreshTokens).toHaveLength(2)
  })

  it('uses the current user role when rotating, not the historical token role', async () => {
    const userRepository = new InMemoryUserRepository(createUser({ role: Role.COACH }))
    const { service } = createService(undefined, ['admin-era-token', 'coach-era-token'], userRepository)
    const issued = await service.issueRefreshToken('user-1', 'device-1', Role.ADMIN)

    const consumed = await service.verifyAndConsumeRefreshToken(issued.plainToken)

    expect(consumed.currentUser.role).toBe(Role.COACH)
    expect(consumed.rotatedToken.record.role).toBe(Role.COACH)
    expect(consumed.rotatedToken.record.expiresAt?.getTime()).toBe(
      now.getTime() + 7 * 24 * 60 * 60 * 1000
    )
  })

  it('rejects replay of a consumed refresh token without issuing another token', async () => {
    const { service, repository } = createService(undefined, ['first-token', 'rotated-token', 'bad'])
    const issued = await service.issueRefreshToken('user-1', 'device-1', Role.COACH)

    await service.verifyAndConsumeRefreshToken(issued.plainToken)

    await expect(service.verifyAndConsumeRefreshToken(issued.plainToken)).rejects.toBeInstanceOf(
      RefreshTokenRevokedError
    )
    expect(repository.refreshTokens).toHaveLength(2)
  })

  it('does not rotate when the atomic consume operation loses the race', async () => {
    const { service, repository } = createService(undefined, ['race-token', 'should-not-rotate'])
    const issued = await service.issueRefreshToken('user-1', 'device-1', Role.COACH)
    repository.forceNextRotateResult = false

    await expect(service.verifyAndConsumeRefreshToken(issued.plainToken)).rejects.toBeInstanceOf(
      RefreshTokenAlreadyConsumedError
    )
    expect(repository.refreshTokens).toHaveLength(1)
  })

  it('rejects revoked refresh tokens without rotating them', async () => {
    const { service, repository } = createService(undefined, ['revoked-token', 'next-token'])
    const issued = await service.issueRefreshToken('user-1', 'device-1', Role.ADMIN)
    await repository.revokeRefreshToken(issued.record.id)

    await expect(service.verifyAndConsumeRefreshToken(issued.plainToken)).rejects.toBeInstanceOf(
      RefreshTokenRevokedError
    )
    expect(repository.refreshTokens).toHaveLength(1)
  })

  it('rejects expired refresh tokens without rotating them', async () => {
    const { service, repository } = createService(undefined, ['expired-token', 'next-token'])
    await service.issueRefreshToken('user-1', 'device-1', Role.ADMIN)
    const savedToken = repository.refreshTokens[0]
    savedToken.expiresAt = new Date(now.getTime() - 1)

    await expect(service.verifyAndConsumeRefreshToken('expired-token')).rejects.toBeInstanceOf(
      RefreshTokenExpiredError
    )
    expect(repository.revokedTokenIds).toEqual([])
    expect(repository.refreshTokens).toHaveLength(1)
  })

  it('rejects refresh tokens whose user no longer exists', async () => {
    const repository = new InMemoryTokenRepository()
    const issuingService = createService(
      repository,
      ['orphan-token'],
      new InMemoryUserRepository(createUser())
    ).service
    await issuingService.issueRefreshToken('user-1', 'device-1', Role.COACH)

    const missingUserService = createService(
      repository,
      ['unused-token'],
      new InMemoryUserRepository(null)
    ).service

    await expect(missingUserService.verifyAndConsumeRefreshToken('orphan-token')).rejects.toBeInstanceOf(
      RefreshTokenUserNotFoundError
    )
  })

  it('rejects unknown refresh tokens', async () => {
    const { service } = createService()

    await expect(service.verifyAndConsumeRefreshToken('missing-token')).rejects.toBeInstanceOf(
      RefreshTokenNotFoundError
    )
  })
})
