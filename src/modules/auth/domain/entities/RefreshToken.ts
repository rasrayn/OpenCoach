import { Role } from '../value-objects/Role'

/**
 * RefreshToken entity.
 * Represents an issued refresh token (stored as SHA-256 hash).
 */
export interface RefreshToken {
  id: string
  userId: string
  /** SHA-256 hash of the opaque token value */
  tokenHash: string
  deviceId: string
  deviceInfo: DeviceInfo | null
  role: Role
  issuedAt: Date
  /** NULL for ATHLETE, set for COACH (7 days) and ADMIN (1 day) */
  expiresAt: Date | null
  revokedAt: Date | null
}

export interface DeviceInfo {
  deviceId: string
  deviceType: 'WEB' | 'IOS' | 'ANDROID' | 'DESKTOP'
  userAgent?: string
  ip?: string
}
