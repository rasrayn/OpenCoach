import { ITokenSigner } from '../../domain/services/ITokenSigner'
import { TokenPayload } from '../../application/dtos'

/**
 * JwtTokenService — RS256 JWT implementation of ITokenSigner.
 * Full implementation added in Task 7.
 */
export class JwtTokenService implements ITokenSigner {
  sign(_payload: Omit<TokenPayload, 'iat' | 'exp' | 'jti'>): string {
    throw new Error('Not implemented yet — see Task 7')
  }

  verify(_token: string): TokenPayload {
    throw new Error('Not implemented yet — see Task 7')
  }
}
