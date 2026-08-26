import * as fc from 'fast-check'
import { User } from '../../../domain/entities/User'
import { IUserRepository } from '../../../domain/repositories/IUserRepository'
import { Role } from '../../../domain/value-objects/Role'
import {
  InsufficientRoleError,
  InvalidRoleError,
  RoleAssignmentForbiddenError,
  UserNotFoundError,
} from '../../errors'
import { RoleService } from '../RoleService'

const now = new Date('2026-08-26T10:00:00.000Z')
const validRoles = [Role.ADMIN, Role.COACH, Role.ATHLETE] as const

function createUser(overrides: Partial<User> = {}): User {
  return {
    id: 'user-1',
    email: 'user@example.com',
    passwordHash: 'hash',
    role: Role.ATHLETE,
    emailVerified: true,
    isFirstAccess: false,
    createdBy: null,
    createdAt: now,
    updatedAt: now,
    ...overrides,
  }
}

class InMemoryUserRepository implements IUserRepository {
  readonly users = new Map<string, User>()

  constructor(initialUsers: User[] = []) {
    initialUsers.forEach((user) => {
      this.users.set(user.id, user)
    })
  }

  async findById(id: string): Promise<User | null> {
    return this.users.get(id) ?? null
  }

  async findByEmail(email: string): Promise<User | null> {
    return [...this.users.values()].find((user) => user.email === email) ?? null
  }

  async save(user: Omit<User, 'id' | 'createdAt' | 'updatedAt'>): Promise<User> {
    const saved: User = {
      ...user,
      id: `user-${this.users.size + 1}`,
      createdAt: now,
      updatedAt: now,
    }
    this.users.set(saved.id, saved)
    return saved
  }

  async update(
    id: string,
    updates: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>
  ): Promise<User> {
    const current = this.users.get(id)
    if (!current) {
      throw new Error(`User not found: ${id}`)
    }

    const updated: User = {
      ...current,
      ...updates,
      updatedAt: now,
    }
    this.users.set(id, updated)
    return updated
  }

  async delete(id: string): Promise<void> {
    this.users.delete(id)
  }
}

function createService(initialUsers: User[] = []) {
  const repository = new InMemoryUserRepository(initialUsers)
  return {
    repository,
    service: new RoleService(repository),
  }
}

describe('RoleService.canCreateRole - property tests (Propiedad 3)', () => {
  it('respects the role hierarchy for account creation', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom<Role | null>(...validRoles, null),
        fc.constantFrom(...validRoles),
        async (requesterRole, targetRole) => {
          const { service } = createService()

          const allowed =
            (requesterRole === null && targetRole === Role.COACH) ||
            requesterRole === Role.ADMIN ||
            (requesterRole === Role.COACH && targetRole === Role.ATHLETE)

          expect(service.canCreateRole(requesterRole, targetRole)).toBe(allowed)
        }
      ),
      { numRuns: 80 }
    )
  })
})

describe('RoleService.canAssignRole - property tests', () => {
  it('centralizes the authenticated role assignment policy', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...validRoles),
        fc.constantFrom(...validRoles),
        async (requesterRole, targetRole) => {
          const { service } = createService()
          const allowed =
            requesterRole === Role.ADMIN ||
            (requesterRole === Role.COACH && targetRole === Role.ATHLETE)

          expect(service.canAssignRole(requesterRole, targetRole)).toBe(allowed)
        }
      ),
      { numRuns: 80 }
    )
  })
})

describe('RoleService.assignRole - property tests', () => {
  it('rejects role assignments outside the centralized policy', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...validRoles),
        fc.constantFrom(...validRoles),
        async (requesterRole, newRole) => {
          fc.pre(
            !(
              requesterRole === Role.ADMIN ||
              (requesterRole === Role.COACH && newRole === Role.ATHLETE)
            )
          )

          const requester = createUser({
            id: 'requester',
            email: `${requesterRole.toLowerCase()}@example.com`,
            role: requesterRole,
          })
          const target = createUser({
            id: 'target',
            email: 'target@example.com',
            role: Role.ATHLETE,
          })
          const { service, repository } = createService([requester, target])

          const error = await captureRejected(() =>
            service.assignRole(target.id, newRole, requester.id)
          )

          expect(error).toBeInstanceOf(RoleAssignmentForbiddenError)
          expect(error).toMatchObject({
            requesterRole,
            targetRole: newRole,
          })
          expect(repository.users.get(target.id)?.role).toBe(Role.ATHLETE)
        }
      ),
      { numRuns: 60 }
    )
  })

  it('updates the target role when the requester can assign that role', async () => {
    await fc.assert(
      fc.asyncProperty(
        fc.constantFrom(...validRoles),
        fc.constantFrom(...validRoles),
        async (requesterRole, newRole) => {
          fc.pre(
            requesterRole === Role.ADMIN ||
              (requesterRole === Role.COACH && newRole === Role.ATHLETE)
          )

          const requester = createUser({
            id: 'requester',
            email: `${requesterRole.toLowerCase()}@example.com`,
            role: requesterRole,
          })
          const target = createUser({
            id: 'target',
            email: 'target@example.com',
            role: Role.ATHLETE,
          })
          const { service, repository } = createService([requester, target])

          await service.assignRole(target.id, newRole, requester.id)

          expect(repository.users.get(target.id)?.role).toBe(newRole)
        }
      ),
      { numRuns: 40 }
    )
  })
})

describe('RoleService role validation - property tests (Propiedad 19)', () => {
  it('rejects roles outside the system enum', async () => {
    const invalidRoleArb = fc
      .string({ minLength: 1, maxLength: 20 })
      .filter((value) => !validRoles.includes(value as Role))

    await fc.assert(
      fc.asyncProperty(invalidRoleArb, async (invalidRole) => {
        const admin = createUser({ id: 'admin', email: 'admin@example.com', role: Role.ADMIN })
        const target = createUser({ id: 'target', email: 'target@example.com', role: Role.ATHLETE })
        const { service } = createService([admin, target])

        const syncError = captureError(() => service.canCreateRole(Role.ADMIN, invalidRole as Role))

        expect(syncError).toBeInstanceOf(InvalidRoleError)
        expect(syncError).toMatchObject({
          role: invalidRole,
        })
        const error = await captureRejected(() =>
          service.assignRole(target.id, invalidRole as Role, admin.id)
        )

        expect(error).toBeInstanceOf(InvalidRoleError)
        expect(error).toMatchObject({
          role: invalidRole,
        })
      }),
      { numRuns: 80 }
    )
  })
})

describe('RoleService.validatePermission', () => {
  it('returns true when the user has the required role', async () => {
    const user = createUser({ id: 'coach', email: 'coach@example.com', role: Role.COACH })
    const { service } = createService([user])

    await expect(service.validatePermission(user.id, Role.COACH)).resolves.toBe(true)
  })

  it('rejects when the user does not have the required role', async () => {
    const user = createUser({ id: 'athlete', email: 'athlete@example.com', role: Role.ATHLETE })
    const { service } = createService([user])

    const error = await captureRejected(() => service.validatePermission(user.id, Role.ADMIN))

    expect(error).toBeInstanceOf(InsufficientRoleError)
    expect(error).toMatchObject({
      requiredRole: Role.ADMIN,
    })
  })

  it('rejects when the user does not exist', async () => {
    const { service } = createService()

    const error = await captureRejected(() => service.validatePermission('missing-user', Role.ADMIN))

    expect(error).toBeInstanceOf(UserNotFoundError)
    expect(error).toMatchObject({
      userId: 'missing-user',
    })
  })
})

function captureError(action: () => unknown): unknown {
  try {
    action()
    return null
  } catch (error) {
    return error
  }
}

async function captureRejected(action: () => Promise<unknown>): Promise<unknown> {
  try {
    await action()
    return null
  } catch (error) {
    return error
  }
}
