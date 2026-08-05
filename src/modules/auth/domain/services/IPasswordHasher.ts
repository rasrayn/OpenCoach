/**
 * IPasswordHasher — domain interface for password hashing.
 * Concrete implementation (bcrypt) lives in infrastructure/security/.
 */
export interface IPasswordHasher {
  /**
   * Hashes a plain-text password.
   * Returns the hash string (bcrypt format).
   */
  hash(plainPassword: string): Promise<string>

  /**
   * Compares a plain-text password against a stored hash.
   * Returns true if they match.
   */
  compare(plainPassword: string, hash: string): Promise<boolean>
}
