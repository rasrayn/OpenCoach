import { TokenPayload } from '../../application/dtos'

/**
 * ITokenSigner — domain interface for JWT signing and verification.
 * Concrete implementation (RS256 JWT) lives in infrastructure/security/.
 */
export interface ITokenSigner {
  /**
   * Signs a payload and returns a compact JWT string.
   * The token expires in 15 minutes by default.
   */
  sign(payload: Omit<TokenPayload, 'iat' | 'exp' | 'jti'>): string

  /**
   * Verifies a JWT string and returns the decoded payload.
   * Throws if the token is invalid or expired.
   */
  verify(token: string): TokenPayload
}
