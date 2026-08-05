/**
 * PasswordResetToken entity.
 * Represents a one-time-use token for resetting a user's password.
 * Expires 1 hour after issuance.
 */
export interface PasswordResetToken {
  id: string
  userId: string
  /** SHA-256 hash of the opaque token value */
  tokenHash: string
  issuedAt: Date
  expiresAt: Date
  usedAt: Date | null
}
