import { Role } from '../../domain/value-objects/Role'

// ── Input DTOs ────────────────────────────────────────────────────────────────

export interface LoginRequest {
  email: string
  password: string
  deviceId: string
  deviceType: 'WEB' | 'IOS' | 'ANDROID' | 'DESKTOP'
}

export interface CoachRegistrationData {
  email: string
  password: string
  gymName?: string
  program?: string
}

export interface AdminCreateUserData {
  email: string
  password: string
  role: 'ADMIN' | 'COACH'
}

export interface CoachCreateAthleteData {
  email: string
  password: string
}

export interface ChangePasswordData {
  userId: string
  currentPassword: string
  newPassword: string
}

export interface ResetPasswordData {
  resetToken: string
  newPassword: string
}

export interface RefreshTokenRequest {
  refreshToken: string
}

export interface RevokeSessionsRequest {
  userId: string
}

// ── Output DTOs ───────────────────────────────────────────────────────────────

export interface AuthResult {
  /** JWT access token; expires in 15 minutes */
  accessToken: string
  /** Opaque refresh token; duration depends on role */
  refreshToken: string
  /** Seconds until the access token expires (900) */
  expiresIn: number
  tokenType: 'Bearer'
  user: UserSummary
}

export interface AccessTokenResult {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: 'Bearer'
}

export interface UserSummary {
  id: string
  email: string
  role: Role
  emailVerified: boolean
  isFirstAccess: boolean
}

export interface TokenPayload {
  /** Subject: userId */
  sub: string
  role: Role
  email: string
  emailVerified: boolean
  /** Issued-at (Unix timestamp) */
  iat: number
  /** Expiry (Unix timestamp) */
  exp: number
  /** Unique token ID (jti claim) */
  jti: string
}

// ── Password validation ───────────────────────────────────────────────────────

export interface PasswordValidationResult {
  valid: boolean
  errors: string[]
}

// ── Audit ─────────────────────────────────────────────────────────────────────

export type AuditEventType =
  | 'AUTH_SUCCESS'
  | 'AUTH_FAILURE'
  | 'LOGOUT'
  | 'PASSWORD_CHANGE'
  | 'PASSWORD_RESET'
  | 'ACCOUNT_CREATED'
  | 'ROLE_CHANGED'
  | 'ACCOUNT_LOCKED'
  | 'EMAIL_VERIFIED'

export interface AuditEvent {
  userId: string | null
  eventType: AuditEventType
  occurredAt: Date
  ipAddress: string
  deviceInfo: {
    deviceId?: string
    deviceType?: 'WEB' | 'IOS' | 'ANDROID' | 'DESKTOP'
    userAgent?: string
  } | null
  metadata?: Record<string, unknown>
}
