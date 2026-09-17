import { UserService } from '../UserService'
import { IUserRepository } from '../../../domain/repositories/IUserRepository'
import { IPasswordHasher } from '../../../domain/services/IPasswordHasher'
import { User } from '../../../domain/entities/User'
import { Role } from '../../../domain/value-objects/Role'
import { IRoleService } from '../../ports/IRoleService'
import { IAuditService, ICoachProfileRepository } from '../../ports'

class InMemoryUserRepository implements IUserRepository {
  constructor(private users: User[] = []) {}
  async findById(id: string) { return this.users.find((user) => user.id === id) ?? null }
  async findByEmail(email: string) { return this.users.find((user) => user.email === email) ?? null }
  async save(data: Omit<User, 'id' | 'createdAt' | 'updatedAt'>) {
    const now = new Date()
    const user = { ...data, id: `user-${this.users.length + 1}`, createdAt: now, updatedAt: now }
    this.users.push(user)
    return user
  }
  async update(id: string, updates: Partial<Omit<User, 'id' | 'createdAt' | 'updatedAt'>>) {
    const user = await this.findById(id)
    if (!user) throw new Error('missing')
    Object.assign(user, updates)
    return user
  }
  async delete(id: string) { this.users = this.users.filter((user) => user.id !== id) }
}

const hasher: IPasswordHasher = {
  hash: jest.fn(async (password: string) => `bcrypt-hash:${password}`),
  compare: jest.fn(),
}
const roleService: IRoleService = {
  assignRole: jest.fn(), assertPermission: jest.fn(),
  canAssignRole: jest.fn(() => true), canChangeRole: jest.fn(() => true),
  canCreateRole: jest.fn((requesterRole, targetRole) => requesterRole === Role.COACH && targetRole === Role.ATHLETE),
}

function buildService(users: User[] = []) {
  const repository = new InMemoryUserRepository(users)
  const profiles: unknown[] = []
  const auditService: IAuditService = { log: jest.fn(async () => undefined) }
  const profileRepository: ICoachProfileRepository = { save: jest.fn(async (profile) => { profiles.push(profile) }) }
  const emailService = {
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    sendCredentialsEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  }
  return { service: new UserService(repository, hasher, roleService, auditService, profileRepository, emailService), repository, profiles, auditService, profileRepository, emailService }
}

describe('UserService', () => {
  beforeEach(() => jest.clearAllMocks())

  it('registers a coach with optional profile fields and audits creation', async () => {
    const { service, profiles, auditService, emailService } = buildService()
    const user = await service.registerCoach({ email: 'Coach@Example.com', password: 'Secure1!' })
    expect(user).toMatchObject({ email: 'coach@example.com', role: Role.COACH, emailVerified: false, isFirstAccess: false })
    expect(profiles).toEqual([{ userId: user.id, gymName: undefined, program: undefined }])
    expect(auditService.log).toHaveBeenCalledWith(expect.objectContaining({ eventType: 'ACCOUNT_CREATED', userId: user.id }))
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(user.id)
    expect(emailService.sendCredentialsEmail).not.toHaveBeenCalled()
  })

  it('allows an admin to create only active admins or coaches', async () => {
    const admin: User = { id: 'admin', email: 'admin@example.com', passwordHash: 'hash', role: Role.ADMIN, emailVerified: true, isFirstAccess: false, createdBy: null, createdAt: new Date(), updatedAt: new Date() }
    const { service, emailService } = buildService([admin])
    const user = await service.createUserByAdmin({ email: 'new@example.com', password: 'Secure1!', role: 'COACH' }, admin.id)
    expect(user).toMatchObject({ role: Role.COACH, emailVerified: false, isFirstAccess: false, createdBy: admin.id })
    expect(emailService.sendCredentialsEmail).toHaveBeenCalledWith(user.id, 'Secure1!')
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(user.id)
  })

  it('creates an active first-access athlete for a coach', async () => {
    const coach: User = { id: 'coach', email: 'coach@example.com', passwordHash: 'hash', role: Role.COACH, emailVerified: true, isFirstAccess: false, createdBy: null, createdAt: new Date(), updatedAt: new Date() }
    const { service, emailService } = buildService([coach])
    const user = await service.createAthleteByCoach({ email: 'athlete@example.com', password: 'Secure1!' }, coach.id)
    expect(user).toMatchObject({ role: Role.ATHLETE, emailVerified: false, isFirstAccess: true, createdBy: coach.id })
    expect(emailService.sendCredentialsEmail).toHaveBeenCalledWith(user.id, 'Secure1!')
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(user.id)
  })

  it('preserves the created account and profile if verification delivery fails', async () => {
    const { service, repository, profiles, emailService } = buildService()
    emailService.sendVerificationEmail.mockRejectedValue(new Error('delivery failed'))
    await expect(service.registerCoach({ email: 'coach@example.com', password: 'Secure1!' })).rejects.toThrow('delivery failed')
    expect(await repository.findByEmail('coach@example.com')).not.toBeNull()
    expect(profiles).toHaveLength(1)
  })

  it('attempts both creation emails and keeps the athlete if credential delivery fails', async () => {
    const coach: User = { id: 'coach', email: 'coach@example.com', passwordHash: 'hash', role: Role.COACH, emailVerified: true, isFirstAccess: false, createdBy: null, createdAt: new Date(), updatedAt: new Date() }
    const { service, repository, emailService } = buildService([coach])
    emailService.sendCredentialsEmail.mockRejectedValue(new Error('delivery failed'))
    await expect(service.createAthleteByCoach({ email: 'athlete@example.com', password: 'Secure1!' }, coach.id)).rejects.toThrow('delivery failed')
    const user = await repository.findByEmail('athlete@example.com')
    expect(user).not.toBeNull()
    expect(emailService.sendVerificationEmail).toHaveBeenCalledWith(user!.id)
  })
})
