import { IPasswordHasher } from '../../domain/services/IPasswordHasher'

/**
 * BcryptPasswordHasher — bcrypt implementation of IPasswordHasher.
 * Full implementation added in Task 9 (uses bcrypt with cost factor ≥ 12).
 */
export class BcryptPasswordHasher implements IPasswordHasher {
  async hash(_plainPassword: string): Promise<string> {
    throw new Error('Not implemented yet — see Task 9')
  }

  async compare(_plainPassword: string, _hash: string): Promise<boolean> {
    throw new Error('Not implemented yet — see Task 9')
  }
}
