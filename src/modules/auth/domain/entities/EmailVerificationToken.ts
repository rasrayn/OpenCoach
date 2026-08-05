/**
 * EmailVerificationToken entity.
 * Represents a one-time-use token for verifying a user's email address.
 * Expires 24 hours after issuance.
 */
export interface EmailVerificationToken {
  id: string
  userId: string
  /** SHA-256 hash of the opaque token value */
  tokenHash: string
  issuedAt: Date
  expiresAt: Date
  usedAt: Date | null
}
