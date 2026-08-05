/**
 * Role value object / enum
 * Represents the three roles in the system hierarchy.
 */
export enum Role {
  ADMIN = 'ADMIN',
  COACH = 'COACH',
  ATHLETE = 'ATHLETE',
}

/**
 * Returns true if the given string is a valid Role.
 */
export function isValidRole(value: string): value is Role {
  return Object.values(Role).includes(value as Role)
}
