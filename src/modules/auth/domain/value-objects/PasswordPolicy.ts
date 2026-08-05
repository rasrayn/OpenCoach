/**
 * PasswordPolicy value object.
 * Encapsulates the rules that a password must comply with.
 */
export interface PasswordValidationResult {
  valid: boolean
  errors: string[]
}

export class PasswordPolicy {
  static readonly MIN_LENGTH = 8

  /**
   * Validates a plain-text password against all policy criteria.
   * Returns a result with `valid` flag and a list of unmet criteria.
   */
  static validate(password: string): PasswordValidationResult {
    const errors: string[] = []
    if (password.length < PasswordPolicy.MIN_LENGTH) {
      errors.push('Mínimo 8 caracteres')
    }
    if (!/[A-Z]/.test(password)) {
      errors.push('Al menos una letra mayúscula')
    }
    if (!/[a-z]/.test(password)) {
      errors.push('Al menos una letra minúscula')
    }
    if (!/[0-9]/.test(password)) {
      errors.push('Al menos un dígito numérico')
    }
    if (!/[^A-Za-z0-9]/.test(password)) {
      errors.push('Al menos un carácter especial')
    }
    return { valid: errors.length === 0, errors }
  }
}
