import { Role } from '../../../domain/value-objects/Role'
import { PostgresTokenRepository } from '../PostgresTokenRepository'
import { DbPool } from '../PostgresUserRepository'

function createPool(rowCount = 1): { pool: DbPool; calls: Array<{ text: string; values?: unknown[] }> } {
  const calls: Array<{ text: string; values?: unknown[] }> = []
  const row = {
    id: 'refresh-token-1',
    user_id: 'user-1',
    token_hash: 'hash-1',
    device_id: 'device-1',
    device_info: null,
    role: Role.COACH,
    issued_at: '2026-08-25T10:00:00.000Z',
    expires_at: '2026-09-01T10:00:00.000Z',
    revoked_at: null,
    consumed_id: 'refresh-token-1',
    consumed_user_id: 'user-1',
    consumed_token_hash: 'old-hash',
    consumed_device_id: 'device-1',
    consumed_device_info: null,
    consumed_role: Role.ADMIN,
    consumed_issued_at: '2026-08-25T10:00:00.000Z',
    consumed_expires_at: '2026-08-26T10:00:00.000Z',
    consumed_revoked_at: '2026-08-25T10:05:00.000Z',
    rotated_id: 'refresh-token-2',
    rotated_user_id: 'user-1',
    rotated_token_hash: 'new-hash',
    rotated_device_id: 'device-1',
    rotated_device_info: null,
    rotated_role: Role.COACH,
    rotated_issued_at: '2026-08-25T10:05:00.000Z',
    rotated_expires_at: '2026-09-01T10:05:00.000Z',
    rotated_revoked_at: null,
  }
  const pool: DbPool = {
    query: async <T = Record<string, unknown>>(text: string, values?: unknown[]) => {
      calls.push({ text, values })
      return {
        rows: rowCount === 0 ? [] : ([row] as unknown as T[]),
        rowCount,
      }
    },
  }

  return { pool, calls }
}

describe('PostgresTokenRepository - refresh token atomic operations', () => {
  it('inserts refresh tokens as historical rows without overwriting the previous device token', async () => {
    const { pool, calls } = createPool()
    const repository = new PostgresTokenRepository(pool)

    await repository.saveRefreshToken({
      userId: 'user-1',
      tokenHash: 'hash-1',
      deviceId: 'device-1',
      deviceInfo: null,
      role: Role.COACH,
      expiresAt: new Date('2026-09-01T10:00:00.000Z'),
      revokedAt: null,
    })

    expect(calls[0].text).toContain('INSERT INTO refresh_tokens')
    expect(calls[0].text).not.toContain('ON CONFLICT')
    expect(calls[0].values).toEqual([
      'user-1',
      'hash-1',
      'device-1',
      null,
      Role.COACH,
      new Date('2026-09-01T10:00:00.000Z'),
      null,
    ])
  })

  it('rotates a refresh token with one atomic CTE and reports whether it won the race', async () => {
    const winning = createPool(1)
    const losing = createPool(0)
    const newToken = {
      userId: 'user-1',
      tokenHash: 'new-hash',
      deviceId: 'device-1',
      deviceInfo: null,
      role: Role.COACH,
      expiresAt: new Date('2026-09-01T10:05:00.000Z'),
      revokedAt: null,
    }

    await expect(
      new PostgresTokenRepository(winning.pool).rotateRefreshToken({
        consumedTokenId: 'token-id',
        consumedTokenHash: 'old-hash',
        newToken,
      })
    ).resolves.toEqual(
      expect.objectContaining({
        consumedToken: expect.objectContaining({ id: 'refresh-token-1', tokenHash: 'old-hash' }),
        rotatedToken: expect.objectContaining({ id: 'refresh-token-2', tokenHash: 'new-hash' }),
      })
    )
    await expect(
      new PostgresTokenRepository(losing.pool).rotateRefreshToken({
        consumedTokenId: 'token-id',
        consumedTokenHash: 'old-hash',
        newToken,
      })
    ).resolves.toBeNull()

    expect(winning.calls[0].text).toContain('WITH consumed AS')
    expect(winning.calls[0].text).toContain('UPDATE refresh_tokens')
    expect(winning.calls[0].text).toContain('AND token_hash = $2')
    expect(winning.calls[0].text).toContain('AND revoked_at IS NULL')
    expect(winning.calls[0].text).toContain('rotated AS')
    expect(winning.calls[0].text).toContain('INSERT INTO refresh_tokens')
    expect(winning.calls[0].values).toEqual([
      'token-id',
      'old-hash',
      'user-1',
      'new-hash',
      'device-1',
      null,
      Role.COACH,
      new Date('2026-09-01T10:05:00.000Z'),
      null,
    ])
  })

  it('revokes the active refresh token for a device before issuing a replacement on login', async () => {
    const { pool, calls } = createPool()
    const repository = new PostgresTokenRepository(pool)

    await repository.revokeActiveRefreshTokensForDevice('user-1', 'device-1')

    expect(calls[0].text).toContain('WHERE user_id = $1')
    expect(calls[0].text).toContain('AND device_id = $2')
    expect(calls[0].text).toContain('AND revoked_at IS NULL')
    expect(calls[0].values).toEqual(['user-1', 'device-1'])
  })
})