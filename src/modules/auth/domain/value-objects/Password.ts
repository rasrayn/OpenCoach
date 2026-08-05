/**
 * Password value object.
 * Wraps a plain-text password that has been validated against the password policy.
 * NOTE: This value object holds the raw (unhashed) password only during creation/validation.
 * It should never be persisted — only the hash is stored.
 */
export class Password {
  private readonly _value: string

  private constructor(value: string) {
    this._value = value
  }

  /**
   * Creates a Password value object after validating against the password policy.
   * Throws if the policy is not satisfied.
   */
  static create(value: string): Password {
    const result = Password.validate(value)
    if (!result.valid) {
      throw new Error(`Invalid password: ${result.errors.join(', ')}`)
    }
    return new Password(value)
  }

  static validate(value: string): { valid: boolean; errors: string[] } {
    const errors: string[] = []
    if (value.length < 8) errors.push('Mínimo 8 caracteres')
    if (!/[A-Z]/.test(value)) errors.push('Al menos una letra mayúscula')
    if (!/[a-z]/.test(value)) errors.push('Al menos una letra minúscula')
    if (!/[0-9]/.test(value)) errors.push('Al menos un dígito numérico')
    if (!/[^A-Za-z0-9]/.test(value)) errors.push('Al menos un carácter especial')
    return { valid: errors.length === 0, errors }
  }

  get value(): string {
    return this._value
  }

  toString(): string {
    return '***'
  }
}
