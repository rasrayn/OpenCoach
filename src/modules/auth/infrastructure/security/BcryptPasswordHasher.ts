import { IPasswordHasher } from '../../domain/services/IPasswordHasher'
import bcrypt from 'bcryptjs'

/**
 * BcryptPasswordHasher — bcrypt implementation of IPasswordHasher.
 * Uses bcrypt with a deliberately explicit cost factor so password storage
 * cannot silently fall below the security requirement.
 */
export class BcryptPasswordHasher implements IPasswordHasher {
  static readonly COST_FACTOR = 12

  async hash(plainPassword: string): Promise<string> {
    return bcrypt.hash(plainPassword, BcryptPasswordHasher.COST_FACTOR)
  }

  async compare(plainPassword: string, hash: string): Promise<boolean> {
    return bcrypt.compare(plainPassword, hash)
  }
}
