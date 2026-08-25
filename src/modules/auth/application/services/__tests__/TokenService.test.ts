import * as fc from 'fast-check'
import { RefreshToken } from '../../../domain/entities/RefreshToken'
import { EmailVerificationToken } from '../../../domain/entities/EmailVerificationToken'
import { PasswordResetToken } from '../../../domain/entities/PasswordResetToken'
import { ITokenRepository } from '../../../domain/repositories/ITokenRepository'
import { ITokenSigner } from '../../../domain/services/ITokenSigner'
import { Role } from '../../../domain/value-objects/Role'
import { TokenPayload } from '../../dtos'
import { TokenService, hashToken } from '../TokenService'

const now = new Date('2026-08-25T10:00:00.000Z')

class InMemoryTokenRepository implements ITokenRepository {
  readonly refreshTokens: RefreshToken[] = []
  readonly revokedTokenIds: string[] = []
  private nextId = 1

  async saveRefreshToken(token: Omit<RefreshToken, 'id' | 'issuedAt'>): Promise<RefreshToken> {
    const existingIndex = this.refreshTokens.findIndex(
      (current) => current.userId === token.userId && current.deviceId === token.deviceId
    )
    const saved: RefreshToken = {
      ...token,
      id:
        existingIndex >= 0
          ? this.refreshTokens[existingIndex].id
          : `refresh-token-${this.nextId++}`,
      issuedAt: now,
    }

    if (existingIndex >= 0) {
      this.refreshTokens[existingIndex] = saved
    } else {
      this.refreshTokens.push(saved)
    }

    return saved
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    return this.refreshTokens.find((token) => token.tokenHash === tokenHash) ?? null
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    this.revokedTokenIds.push(tokenId)
    const token = this.refreshTokens.find((current) => current.id === tokenId)
    if (token) {
      token.revokedAt = now
    }
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

function createService(repository = new InMemoryTokenRepository(), tokens = ['opaque-refresh-token']) {
  let nextToken = 0
  return {
    repository,
    service: new TokenService(new FakeTokenSigner(), repository, {
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
  it('rotates a valid refresh token and revokes the consumed record', async () => {
    const { service, repository } = createService(undefined, ['first-token', 'rotated-token'])
    const issued = await service.issueRefreshToken('user-1', 'device-1', Role.COACH)

    const consumed = await service.verifyAndConsumeRefreshToken(issued.plainToken)

    expect(consumed.consumedToken.id).toBe(issued.record.id)
    expect(repository.revokedTokenIds).toEqual([issued.record.id])
    expect(consumed.rotatedToken.plainToken).toBe('rotated-token')
    expect(consumed.rotatedToken.record.tokenHash).toBe(hashToken('rotated-token'))
  })

  it('rejects revoked refresh tokens without rotating them', async () => {
    const { service, repository } = createService(undefined, ['revoked-token', 'next-token'])
    const issued = await service.issueRefreshToken('user-1', 'device-1', Role.ADMIN)
    await repository.revokeRefreshToken(issued.record.id)

    await expect(service.verifyAndConsumeRefreshToken(issued.plainToken)).rejects.toThrow(
      'Refresh token revoked'
    )
    expect(repository.refreshTokens).toHaveLength(1)
  })

  it('rejects expired refresh tokens without rotating them', async () => {
    const { service, repository } = createService(undefined, ['expired-token', 'next-token'])
    await service.issueRefreshToken('user-1', 'device-1', Role.ADMIN)
    const savedToken = repository.refreshTokens[0]
    savedToken.expiresAt = new Date(now.getTime() - 1)

    await expect(service.verifyAndConsumeRefreshToken('expired-token')).rejects.toThrow(
      'Refresh token expired'
    )
    expect(repository.revokedTokenIds).toEqual([])
    expect(repository.refreshTokens).toHaveLength(1)
  })

  it('rejects unknown refresh tokens', async () => {
    const { service } = createService()

    await expect(service.verifyAndConsumeRefreshToken('missing-token')).rejects.toThrow(
      'Refresh token not found'
    )
  })
})
