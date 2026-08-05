/**
 * Email value object.
 * Wraps a validated email string to ensure it is never invalid within the domain.
 */
export class Email {
  private readonly _value: string

  private constructor(value: string) {
    this._value = value
  }

  /**
   * Creates an Email value object after validation.
   * Throws if the format is invalid.
   */
  static create(value: string): Email {
    const trimmed = value.trim().toLowerCase()
    if (!Email.isValid(trimmed)) {
      throw new Error(`Invalid email format: ${value}`)
    }
    return new Email(trimmed)
  }

  static isValid(value: string): boolean {
    // RFC 5322–inspired lightweight check
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    return emailRegex.test(value)
  }

  get value(): string {
    return this._value
  }

  equals(other: Email): boolean {
    return this._value === other._value
  }

  toString(): string {
    return this._value
  }
}
