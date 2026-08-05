import { Role } from '../value-objects/Role'

/**
 * User entity — core aggregate root.
 */
export interface User {
  id: string
  email: string
  passwordHash: string
  role: Role
  emailVerified: boolean
  /** Relevant only for ATHLETE: true when first-time credentials have not yet been changed */
  isFirstAccess: boolean
  /** ID of the user who created this account (null for self-registered coaches) */
  createdBy: string | null
  createdAt: Date
  updatedAt: Date
}
