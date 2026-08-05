/**
 * HTTP-layer DTOs for the auth module.
 *
 * These mirror the application DTOs but are specific to the HTTP presentation layer.
 * Mappers in presentation/mappers/ translate between these and application DTOs.
 */

// ── Request DTOs ──────────────────────────────────────────────────────────────

export interface LoginRequestDto {
  email: string
  password: string
  deviceId: string
  deviceType: 'WEB' | 'IOS' | 'ANDROID' | 'DESKTOP'
}

export interface RegisterCoachRequestDto {
  email: string
  password: string
  gymName?: string
  program?: string
}

export interface CreateUserRequestDto {
  email: string
  password: string
  role: 'ADMIN' | 'COACH' | 'ATHLETE'
}

export interface ChangePasswordRequestDto {
  currentPassword: string
  newPassword: string
}

export interface ForgotPasswordRequestDto {
  email: string
}

export interface ResetPasswordRequestDto {
  token: string
  newPassword: string
}

export interface ResendVerificationRequestDto {
  email: string
}

export interface AssignRoleRequestDto {
  role: 'ADMIN' | 'COACH' | 'ATHLETE'
}

export interface RefreshTokenRequestDto {
  refreshToken?: string // optional: may come from cookie on web clients
}

// ── Response DTOs ─────────────────────────────────────────────────────────────

export interface AuthResponseDto {
  accessToken: string
  refreshToken: string
  expiresIn: number
  tokenType: 'Bearer'
  user: UserResponseDto
}

export interface UserResponseDto {
  id: string
  email: string
  role: string
  emailVerified: boolean
  isFirstAccess: boolean
}

export interface MessageResponseDto {
  message: string
}

export interface ErrorResponseDto {
  error: {
    code: string
    message: string
    correlationId: string
    details?: string[]
  }
}
