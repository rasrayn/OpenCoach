import * as fc from 'fast-check'
import { PasswordPolicy } from '../PasswordPolicy'

/**
 * Unit and property-based tests for PasswordPolicy.validate
 *
 * Validates: Requirements 1.3, 2.2, 3.2, 4.8, 4.9, 6.2, 7.4, 10.5
 */

describe('PasswordPolicy.validate — unit tests', () => {
  describe('valid passwords', () => {
    it('accepts a password that satisfies all criteria', () => {
      const result = PasswordPolicy.validate('Secure#1')
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })

    it('accepts a long password with all required character types', () => {
      const result = PasswordPolicy.validate('MyStr0ng!Password')
      expect(result.valid).toBe(true)
      expect(result.errors).toHaveLength(0)
    })
  })

  describe('single-criterion violations', () => {
    it('rejects a password that is too short', () => {
      const result = PasswordPolicy.validate('Ab1!')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Mínimo 8 caracteres')
    })

    it('rejects a password missing an uppercase letter', () => {
      const result = PasswordPolicy.validate('secure#1')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Al menos una letra mayúscula')
      expect(result.errors).not.toContain('Al menos una letra minúscula')
    })

    it('rejects a password missing a lowercase letter', () => {
      const result = PasswordPolicy.validate('SECURE#1')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Al menos una letra minúscula')
      expect(result.errors).not.toContain('Al menos una letra mayúscula')
    })

    it('rejects a password missing a numeric digit', () => {
      const result = PasswordPolicy.validate('Secure##')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Al menos un dígito numérico')
    })

    it('rejects a password missing a special character', () => {
      const result = PasswordPolicy.validate('Secure12')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Al menos un carácter especial')
    })
  })

  describe('multiple-criterion violations', () => {
    it('returns all failing criteria when every criterion is unmet', () => {
      const result = PasswordPolicy.validate('abc')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Mínimo 8 caracteres')
      expect(result.errors).toContain('Al menos una letra mayúscula')
      expect(result.errors).toContain('Al menos un dígito numérico')
      expect(result.errors).toContain('Al menos un carácter especial')
      // 'abc' does have lowercase letters so that criterion should not appear
      expect(result.errors).not.toContain('Al menos una letra minúscula')
    })

    it('returns exactly the failing criteria for a password missing upper and digit', () => {
      const result = PasswordPolicy.validate('secure#!')   // 8 chars, lower ✓, no upper, no digit
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Al menos una letra mayúscula')
      expect(result.errors).toContain('Al menos un dígito numérico')
      expect(result.errors).not.toContain('Mínimo 8 caracteres')
      expect(result.errors).not.toContain('Al menos una letra minúscula')
      expect(result.errors).not.toContain('Al menos un carácter especial')
    })
  })

  describe('edge cases', () => {
    it('treats a password of exactly 8 characters satisfying all criteria as valid', () => {
      const result = PasswordPolicy.validate('Ab1!Ab1!')
      expect(result.valid).toBe(true)
    })

    it('treats a password of exactly 7 characters as invalid (too short)', () => {
      const result = PasswordPolicy.validate('Ab1!Ab1')
      expect(result.valid).toBe(false)
      expect(result.errors).toContain('Mínimo 8 caracteres')
    })

    it('rejects an empty string', () => {
      const result = PasswordPolicy.validate('')
      expect(result.valid).toBe(false)
      expect(result.errors.length).toBeGreaterThan(0)
    })
  })
})

/**
 * Property-Based Test
 *
 * Propiedad 1: Validación de contraseña es exhaustiva y coherente
 *
 * For any string, validate() must return:
 *   - valid=true  iff ALL five criteria are simultaneously satisfied
 *   - valid=false with errors containing EXACTLY the unmet criteria
 *
 * Validates: Requirements 1.3, 2.2, 3.2, 4.8, 4.9, 6.2, 7.4, 10.5
 */
describe('PasswordPolicy.validate — property tests (Propiedad 1)', () => {
  const hasLength  = (s: string) => s.length >= 8
  const hasUpper   = (s: string) => /[A-Z]/.test(s)
  const hasLower   = (s: string) => /[a-z]/.test(s)
  const hasDigit   = (s: string) => /[0-9]/.test(s)
  const hasSpecial = (s: string) => /[^A-Za-z0-9]/.test(s)

  /**
   * Core property: valid ↔ all five criteria hold simultaneously.
   * Any failure here means validate() disagrees with at least one criterion check.
   */
  it('valid=true iff all five criteria are satisfied simultaneously', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 100 }), (password) => {
        const result = PasswordPolicy.validate(password)
        const allMet =
          hasLength(password) &&
          hasUpper(password) &&
          hasLower(password) &&
          hasDigit(password) &&
          hasSpecial(password)

        expect(result.valid).toBe(allMet)
      }),
      { numRuns: 200 }
    )
  })

  /**
   * Precision property: errors contains exactly the unmet criteria — no more, no less.
   * Each of the five expected error messages is present iff its criterion fails.
   */
  it('errors list contains exactly the unmet criteria — no more, no less', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 100 }), (password) => {
        const result = PasswordPolicy.validate(password)

        if (!hasLength(password)) {
          expect(result.errors).toContain('Mínimo 8 caracteres')
        } else {
          expect(result.errors).not.toContain('Mínimo 8 caracteres')
        }

        if (!hasUpper(password)) {
          expect(result.errors).toContain('Al menos una letra mayúscula')
        } else {
          expect(result.errors).not.toContain('Al menos una letra mayúscula')
        }

        if (!hasLower(password)) {
          expect(result.errors).toContain('Al menos una letra minúscula')
        } else {
          expect(result.errors).not.toContain('Al menos una letra minúscula')
        }

        if (!hasDigit(password)) {
          expect(result.errors).toContain('Al menos un dígito numérico')
        } else {
          expect(result.errors).not.toContain('Al menos un dígito numérico')
        }

        if (!hasSpecial(password)) {
          expect(result.errors).toContain('Al menos un carácter especial')
        } else {
          expect(result.errors).not.toContain('Al menos un carácter especial')
        }
      }),
      { numRuns: 200 }
    )
  })

  /**
   * Consistency property: valid and errors are always in agreement.
   * valid=false implies errors is non-empty, valid=true implies errors is empty.
   */
  it('valid and errors are always consistent with each other', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 100 }), (password) => {
        const result = PasswordPolicy.validate(password)
        if (result.valid) {
          expect(result.errors).toHaveLength(0)
        } else {
          expect(result.errors.length).toBeGreaterThan(0)
        }
      }),
      { numRuns: 200 }
    )
  })

  /**
   * Positive property: passwords built to satisfy all criteria are always accepted.
   * Generates strings that are guaranteed to contain at least one of each required
   * character type, then verifies validate() agrees.
   */
  it('passwords constructed to meet all criteria are always accepted', () => {
    // Build a valid password by concatenating one guaranteed char per criterion
    // plus a random suffix, then shuffling deterministically via sort.
    const validPasswordArb = fc
      .tuple(
        fc.stringMatching(/[A-Z]/),    // at least one uppercase
        fc.stringMatching(/[a-z]/),    // at least one lowercase
        fc.stringMatching(/[0-9]/),    // at least one digit
        fc.constantFrom('!', '@', '#', '$', '%', '^', '&', '*', '-', '_', '+', '='),
        fc.string({ minLength: 4, maxLength: 20 })
      )
      .map(([upper, lower, digit, special, rest]) => upper + lower + digit + special + rest)
      .filter((s) => s.length >= 8)

    fc.assert(
      fc.property(validPasswordArb, (password) => {
        const result = PasswordPolicy.validate(password)
        expect(result.valid).toBe(true)
        expect(result.errors).toHaveLength(0)
      }),
      { numRuns: 200 }
    )
  })

  /**
   * Error count property: the number of errors equals the number of unmet criteria.
   * Verifies there are no duplicate or spurious error messages.
   */
  it('error count equals the exact number of unmet criteria', () => {
    fc.assert(
      fc.property(fc.string({ minLength: 0, maxLength: 100 }), (password) => {
        const result = PasswordPolicy.validate(password)

        const unmetCount = [
          !hasLength(password),
          !hasUpper(password),
          !hasLower(password),
          !hasDigit(password),
          !hasSpecial(password),
        ].filter(Boolean).length

        expect(result.errors).toHaveLength(unmetCount)
      }),
      { numRuns: 200 }
    )
  })
})
