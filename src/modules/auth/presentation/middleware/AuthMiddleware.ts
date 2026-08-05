/**
 * AuthMiddleware — verifies JWT access tokens from the Authorization header
 * or the __Secure-refresh_token cookie (web clients).
 *
 * Full implementation added in Task 14.
 */
export interface AuthenticatedRequest {
  userId: string
  role: string
  email: string
  emailVerified: boolean
  jti: string
}

// Placeholder — wired up in Task 14
export class AuthMiddleware {
  // verify(req, res, next): void { ... }
}
