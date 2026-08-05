import { ITokenRepository } from '../../domain/repositories/ITokenRepository'
import { RefreshToken, DeviceInfo } from '../../domain/entities/RefreshToken'
import { EmailVerificationToken } from '../../domain/entities/EmailVerificationToken'
import { PasswordResetToken } from '../../domain/entities/PasswordResetToken'
import { Role } from '../../domain/value-objects/Role'
import { DbPool } from './PostgresUserRepository'

// ── Row mappers ───────────────────────────────────────────────────────────────

function rowToRefreshToken(row: Record<string, unknown>): RefreshToken {
  return {
    id: row['id'] as string,
    userId: row['user_id'] as string,
    tokenHash: row['token_hash'] as string,
    deviceId: row['device_id'] as string,
    deviceInfo: (row['device_info'] as DeviceInfo | null) ?? null,
    role: row['role'] as Role,
    issuedAt: new Date(row['issued_at'] as string),
    expiresAt: row['expires_at'] != null ? new Date(row['expires_at'] as string) : null,
    revokedAt: row['revoked_at'] != null ? new Date(row['revoked_at'] as string) : null,
  }
}

function rowToEmailVerificationToken(
  row: Record<string, unknown>
): EmailVerificationToken {
  return {
    id: row['id'] as string,
    userId: row['user_id'] as string,
    tokenHash: row['token_hash'] as string,
    issuedAt: new Date(row['issued_at'] as string),
    expiresAt: new Date(row['expires_at'] as string),
    usedAt: row['used_at'] != null ? new Date(row['used_at'] as string) : null,
  }
}

function rowToPasswordResetToken(row: Record<string, unknown>): PasswordResetToken {
  return {
    id: row['id'] as string,
    userId: row['user_id'] as string,
    tokenHash: row['token_hash'] as string,
    issuedAt: new Date(row['issued_at'] as string),
    expiresAt: new Date(row['expires_at'] as string),
    usedAt: row['used_at'] != null ? new Date(row['used_at'] as string) : null,
  }
}

/**
 * PostgresTokenRepository — PostgreSQL implementation of ITokenRepository.
 * All queries use parameterized placeholders ($1, $2, …) to prevent SQL injection.
 */
export class PostgresTokenRepository implements ITokenRepository {
  constructor(private readonly pool: DbPool) {}

  // ── Refresh Tokens ──────────────────────────────────────────────────────────

  async saveRefreshToken(
    token: Omit<RefreshToken, 'id' | 'issuedAt'>
  ): Promise<RefreshToken> {
    const result = await this.pool.query<Record<string, unknown>>(
      `INSERT INTO refresh_tokens
         (user_id, token_hash, device_id, device_info, role, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (user_id, device_id)
         DO UPDATE SET
           token_hash  = EXCLUDED.token_hash,
           device_info = EXCLUDED.device_info,
           role        = EXCLUDED.role,
           issued_at   = NOW(),
           expires_at  = EXCLUDED.expires_at,
           revoked_at  = NULL
       RETURNING id, user_id, token_hash, device_id, device_info, role,
                 issued_at, expires_at, revoked_at`,
      [
        token.userId,
        token.tokenHash,
        token.deviceId,
        token.deviceInfo ? JSON.stringify(token.deviceInfo) : null,
        token.role,
        token.expiresAt ?? null,
        token.revokedAt ?? null,
      ]
    )
    return rowToRefreshToken(result.rows[0])
  }

  async findRefreshTokenByHash(tokenHash: string): Promise<RefreshToken | null> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT id, user_id, token_hash, device_id, device_info, role,
              issued_at, expires_at, revoked_at
       FROM refresh_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    )
    if (result.rows.length === 0) return null
    return rowToRefreshToken(result.rows[0])
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    await this.pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
      [tokenId]
    )
  }

  async revokeAllRefreshTokensForUser(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE user_id = $1 AND revoked_at IS NULL`,
      [userId]
    )
  }

  async findActiveRefreshTokensByUser(userId: string): Promise<RefreshToken[]> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT id, user_id, token_hash, device_id, device_info, role,
              issued_at, expires_at, revoked_at
       FROM refresh_tokens
       WHERE user_id = $1
         AND revoked_at IS NULL
         AND (expires_at IS NULL OR expires_at > NOW())`,
      [userId]
    )
    return result.rows.map(rowToRefreshToken)
  }

  // ── Email Verification Tokens ───────────────────────────────────────────────

  async saveEmailVerificationToken(
    token: Omit<EmailVerificationToken, 'id' | 'issuedAt'>
  ): Promise<EmailVerificationToken> {
    const result = await this.pool.query<Record<string, unknown>>(
      `INSERT INTO email_verification_tokens (user_id, token_hash, expires_at, used_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, token_hash, issued_at, expires_at, used_at`,
      [token.userId, token.tokenHash, token.expiresAt, token.usedAt ?? null]
    )
    return rowToEmailVerificationToken(result.rows[0])
  }

  async findEmailVerificationTokenByHash(
    tokenHash: string
  ): Promise<EmailVerificationToken | null> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT id, user_id, token_hash, issued_at, expires_at, used_at
       FROM email_verification_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    )
    if (result.rows.length === 0) return null
    return rowToEmailVerificationToken(result.rows[0])
  }

  async markEmailVerificationTokenUsed(tokenId: string): Promise<void> {
    await this.pool.query(
      `UPDATE email_verification_tokens SET used_at = NOW() WHERE id = $1`,
      [tokenId]
    )
  }

  async invalidatePreviousEmailVerificationTokens(userId: string): Promise<void> {
    await this.pool.query(
      `UPDATE email_verification_tokens
       SET used_at = NOW()
       WHERE user_id = $1 AND used_at IS NULL`,
      [userId]
    )
  }

  // ── Password Reset Tokens ───────────────────────────────────────────────────

  async savePasswordResetToken(
    token: Omit<PasswordResetToken, 'id' | 'issuedAt'>
  ): Promise<PasswordResetToken> {
    const result = await this.pool.query<Record<string, unknown>>(
      `INSERT INTO password_reset_tokens (user_id, token_hash, expires_at, used_at)
       VALUES ($1, $2, $3, $4)
       RETURNING id, user_id, token_hash, issued_at, expires_at, used_at`,
      [token.userId, token.tokenHash, token.expiresAt, token.usedAt ?? null]
    )
    return rowToPasswordResetToken(result.rows[0])
  }

  async findPasswordResetTokenByHash(
    tokenHash: string
  ): Promise<PasswordResetToken | null> {
    const result = await this.pool.query<Record<string, unknown>>(
      `SELECT id, user_id, token_hash, issued_at, expires_at, used_at
       FROM password_reset_tokens
       WHERE token_hash = $1`,
      [tokenHash]
    )
    if (result.rows.length === 0) return null
    return rowToPasswordResetToken(result.rows[0])
  }

  async markPasswordResetTokenUsed(tokenId: string): Promise<void> {
    await this.pool.query(
      `UPDATE password_reset_tokens SET used_at = NOW() WHERE id = $1`,
      [tokenId]
    )
  }
}
