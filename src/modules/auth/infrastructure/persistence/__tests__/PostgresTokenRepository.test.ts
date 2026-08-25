import { Role } from '../../../domain/value-objects/Role'
import { PostgresTokenRepository } from '../PostgresTokenRepository'
import { DbPool } from '../PostgresUserRepository'

function createPool(rowCount = 1): { pool: DbPool; calls: Array<{ text: string; values?: unknown[] }> } {
  const calls: Array<{ text: string; values?: unknown[] }> = []
  const pool: DbPool = {
    query: async <T = Record<string, unknown>>(text: string, values?: unknown[]) => {
      calls.push({ text, values })
      return {
        rows: [
          {
            id: 'refresh-token-1',
            user_id: 'user-1',
            token_hash: 'hash-1',
            device_id: 'device-1',
            device_info: null,
            role: Role.COACH,
            issued_at: '2026-08-25T10:00:00.000Z',
            expires_at: '2026-09-01T10:00:00.000Z',
            revoked_at: null,
          },
        ] as unknown as T[],
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

  it('consumes a refresh token with a conditional update and reports whether it won the race', async () => {
    const winning = createPool(1)
    const losing = createPool(0)

    await expect(
      new PostgresTokenRepository(winning.pool).consumeRefreshToken('token-id', 'token-hash')
    ).resolves.toBe(true)
    await expect(
      new PostgresTokenRepository(losing.pool).consumeRefreshToken('token-id', 'token-hash')
    ).resolves.toBe(false)

    expect(winning.calls[0].text).toContain('SET revoked_at = NOW()')
    expect(winning.calls[0].text).toContain('AND token_hash = $2')
    expect(winning.calls[0].text).toContain('AND revoked_at IS NULL')
    expect(winning.calls[0].text).toContain('AND (expires_at IS NULL OR expires_at > NOW())')
    expect(winning.calls[0].values).toEqual(['token-id', 'token-hash'])
  })

  it('revokes the active refresh token for a device before issuing a replacement', async () => {
    const { pool, calls } = createPool()
    const repository = new PostgresTokenRepository(pool)

    await repository.revokeActiveRefreshTokensForDevice('user-1', 'device-1')

    expect(calls[0].text).toContain('WHERE user_id = $1')
    expect(calls[0].text).toContain('AND device_id = $2')
    expect(calls[0].text).toContain('AND revoked_at IS NULL')
    expect(calls[0].values).toEqual(['user-1', 'device-1'])
  })
})