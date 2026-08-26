import {
  ITokenRepository,
  RefreshTokenRotationInput,
  RefreshTokenRotationResult,
} from '../../domain/repositories/ITokenRepository'
import { RefreshToken, DeviceInfo } from '../../domain/entities/RefreshToken'
import { EmailVerificationToken } from '../../domain/entities/EmailVerificationToken'
import { PasswordResetToken } from '../../domain/entities/PasswordResetToken'
import { Role } from '../../domain/value-objects/Role'
import { DbPool } from './PostgresUserRepository'

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

function prefixedRowToRefreshToken(
  row: Record<string, unknown>,
  prefix: 'consumed' | 'rotated'
): RefreshToken {
  return {
    id: row[`${prefix}_id`] as string,
    userId: row[`${prefix}_user_id`] as string,
    tokenHash: row[`${prefix}_token_hash`] as string,
    deviceId: row[`${prefix}_device_id`] as string,
    deviceInfo: (row[`${prefix}_device_info`] as DeviceInfo | null) ?? null,
    role: row[`${prefix}_role`] as Role,
    issuedAt: new Date(row[`${prefix}_issued_at`] as string),
    expiresAt:
      row[`${prefix}_expires_at`] != null
        ? new Date(row[`${prefix}_expires_at`] as string)
        : null,
    revokedAt:
      row[`${prefix}_revoked_at`] != null
        ? new Date(row[`${prefix}_revoked_at`] as string)
        : null,
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
 * PostgresTokenRepository - PostgreSQL implementation of ITokenRepository.
 * All queries use parameterized placeholders ($1, $2, ...) to prevent SQL injection.
 */
export class PostgresTokenRepository implements ITokenRepository {
  constructor(private readonly pool: DbPool) {}

  // Refresh Tokens

  async saveRefreshToken(
    token: Omit<RefreshToken, 'id' | 'issuedAt'>
  ): Promise<RefreshToken> {
    const result = await this.pool.query<Record<string, unknown>>(
      `INSERT INTO refresh_tokens
         (user_id, token_hash, device_id, device_info, role, expires_at, revoked_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
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

  async rotateRefreshToken(
    input: RefreshTokenRotationInput
  ): Promise<RefreshTokenRotationResult | null> {
    const { newToken } = input
    const result = await this.pool.query<Record<string, unknown>>(
      `WITH consumed AS (
         UPDATE refresh_tokens
         SET revoked_at = NOW()
         WHERE id = $1
           AND token_hash = $2
           AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > NOW())
         RETURNING id, user_id, token_hash, device_id, device_info, role,
                   issued_at, expires_at, revoked_at
       ), rotated AS (
         INSERT INTO refresh_tokens
           (user_id, token_hash, device_id, device_info, role, expires_at, revoked_at)
         SELECT $3, $4, $5, $6, $7, $8, $9
         FROM consumed
         RETURNING id, user_id, token_hash, device_id, device_info, role,
                   issued_at, expires_at, revoked_at
       )
       SELECT
         consumed.id AS consumed_id,
         consumed.user_id AS consumed_user_id,
         consumed.token_hash AS consumed_token_hash,
         consumed.device_id AS consumed_device_id,
         consumed.device_info AS consumed_device_info,
         consumed.role AS consumed_role,
         consumed.issued_at AS consumed_issued_at,
         consumed.expires_at AS consumed_expires_at,
         consumed.revoked_at AS consumed_revoked_at,
         rotated.id AS rotated_id,
         rotated.user_id AS rotated_user_id,
         rotated.token_hash AS rotated_token_hash,
         rotated.device_id AS rotated_device_id,
         rotated.device_info AS rotated_device_info,
         rotated.role AS rotated_role,
         rotated.issued_at AS rotated_issued_at,
         rotated.expires_at AS rotated_expires_at,
         rotated.revoked_at AS rotated_revoked_at
       FROM consumed
       CROSS JOIN rotated`,
      [
        input.consumedTokenId,
        input.consumedTokenHash,
        newToken.userId,
        newToken.tokenHash,
        newToken.deviceId,
        newToken.deviceInfo ? JSON.stringify(newToken.deviceInfo) : null,
        newToken.role,
        newToken.expiresAt ?? null,
        newToken.revokedAt ?? null,
      ]
    )

    if (result.rows.length === 0) {
      return null
    }

    return {
      consumedToken: prefixedRowToRefreshToken(result.rows[0], 'consumed'),
      rotatedToken: prefixedRowToRefreshToken(result.rows[0], 'rotated'),
    }
  }

  async revokeRefreshToken(tokenId: string): Promise<void> {
    await this.pool.query(
      `UPDATE refresh_tokens SET revoked_at = NOW() WHERE id = $1`,
      [tokenId]
    )
  }

  async revokeActiveRefreshTokensForDevice(userId: string, deviceId: string): Promise<void> {
    await this.pool.query(
      `UPDATE refresh_tokens
       SET revoked_at = NOW()
       WHERE user_id = $1
         AND device_id = $2
         AND revoked_at IS NULL`,
      [userId, deviceId]
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

  // Email Verification Tokens

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

  // Password Reset Tokens

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