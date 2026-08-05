import { AuthResult, UserSummary } from '../../application/dtos'
import { AuthResponseDto, UserResponseDto } from '../dtos'

/**
 * AuthMapper — maps between application DTOs and HTTP presentation DTOs.
 * Full implementation added in Task 14.
 */
export class AuthMapper {
  static toAuthResponse(result: AuthResult): AuthResponseDto {
    return {
      accessToken: result.accessToken,
      refreshToken: result.refreshToken,
      expiresIn: result.expiresIn,
      tokenType: result.tokenType,
      user: AuthMapper.toUserResponse(result.user),
    }
  }

  static toUserResponse(user: UserSummary): UserResponseDto {
    return {
      id: user.id,
      email: user.email,
      role: user.role,
      emailVerified: user.emailVerified,
      isFirstAccess: user.isFirstAccess,
    }
  }
}
