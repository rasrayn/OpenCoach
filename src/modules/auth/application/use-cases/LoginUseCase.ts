import { LoginRequest, AuthResult } from '../dtos'

/**
 * LoginUseCase — orchestrates credential verification and token issuance.
 * Implementation to be added in a later task.
 */
export interface ILoginUseCase {
  execute(request: LoginRequest, ipAddress: string): Promise<AuthResult>
}
