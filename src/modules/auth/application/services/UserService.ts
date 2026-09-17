import { AuditEvent } from '../dtos'
import { AdminCreateUserData, CoachCreateAthleteData, CoachRegistrationData } from '../dtos'
import { IAuditService, ICoachProfileRepository } from '../ports'
import { IPasswordHasher } from '../../domain/services/IPasswordHasher'
import { IUserRepository } from '../../domain/repositories/IUserRepository'
import { Email } from '../../domain/value-objects/Email'
import { Password } from '../../domain/value-objects/Password'
import { Role, isValidRole } from '../../domain/value-objects/Role'
import {
  InvalidUserCreationRoleError,
  UserCreationForbiddenError,
  UserEmailAlreadyExistsError,
  UserNotFoundError,
} from '../errors'
import { IRoleService } from '../ports/IRoleService'
import { User } from '../../domain/entities/User'
import { IAccountEmailService } from '../ports/IAccountEmailService'

export class UserService {
  constructor(
    private readonly userRepository: IUserRepository,
    private readonly passwordHasher: IPasswordHasher,
    private readonly roleService: IRoleService,
    private readonly auditService: IAuditService,
    private readonly coachProfileRepository: ICoachProfileRepository,
    private readonly emailService: IAccountEmailService,
  ) {}

  async registerCoach(data: CoachRegistrationData): Promise<User> {
    const email = this.validateEmail(data.email)
    const passwordHash = await this.hashPassword(data.password)
    await this.ensureEmailAvailable(email)

    const user = await this.userRepository.save({
      email,
      passwordHash,
      role: Role.COACH,
      emailVerified: false,
      isFirstAccess: false,
      createdBy: null,
    })

    try {
      await this.coachProfileRepository.save({ userId: user.id, gymName: data.gymName, program: data.program })
      await this.auditCreated(user, 'PUBLIC_REGISTRATION')
    } catch (error) {
      await this.userRepository.delete(user.id)
      throw error
    }
    // Delivery happens after persistence: an SMTP failure must not delete an account.
    await this.emailService.sendVerificationEmail(user.id)
    return user
  }

  async createUserByAdmin(data: AdminCreateUserData, adminId: string): Promise<User> {
    const admin = await this.requireUser(adminId)
    if (admin.role !== Role.ADMIN) throw new UserCreationForbiddenError(admin.role, data.role)
    const requestedRole: string = data.role
    if (!isValidRole(requestedRole) || requestedRole === Role.ATHLETE) {
      throw new InvalidUserCreationRoleError(requestedRole)
    }
    const email = this.validateEmail(data.email)
    const passwordHash = await this.hashPassword(data.password)
    await this.ensureEmailAvailable(email)
    const user = await this.userRepository.save({
      email, passwordHash, role: requestedRole as Role, emailVerified: false, isFirstAccess: false, createdBy: adminId,
    })
    await this.completeCreation(user, 'ADMIN_CREATION')
    await this.sendCreationEmails(user, data.password)
    return user
  }

  async createAthleteByCoach(data: CoachCreateAthleteData, coachId: string): Promise<User> {
    const coach = await this.requireUser(coachId)
    if (!this.roleService.canCreateRole(coach.role, Role.ATHLETE)) {
      throw new UserCreationForbiddenError(coach.role, Role.ATHLETE)
    }
    const email = this.validateEmail(data.email)
    const passwordHash = await this.hashPassword(data.password)
    await this.ensureEmailAvailable(email)
    const user = await this.userRepository.save({
      email, passwordHash, role: Role.ATHLETE, emailVerified: false, isFirstAccess: true, createdBy: coachId,
    })
    await this.completeCreation(user, 'COACH_CREATION')
    await this.sendCreationEmails(user, data.password)
    return user
  }

  async getUserById(userId: string): Promise<User> {
    return this.requireUser(userId)
  }

  async getUserByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(this.validateEmail(email))
  }

  private validateEmail(value: string): string {
    return Email.create(value).value
  }

  private async sendCreationEmails(user: User, password: string): Promise<void> {
    // Both sends start immediately, and both settle before reporting failure.
    const results = await Promise.allSettled([
      this.emailService.sendCredentialsEmail(user.id, password),
      this.emailService.sendVerificationEmail(user.id),
    ])
    for (const result of results) {
      if (result.status === 'rejected') throw result.reason
    }
  }

  private async hashPassword(value: string): Promise<string> {
    return this.passwordHasher.hash(Password.create(value).value)
  }

  private async ensureEmailAvailable(email: string): Promise<void> {
    if (await this.userRepository.findByEmail(email)) throw new UserEmailAlreadyExistsError(email)
  }

  private async requireUser(userId: string): Promise<User> {
    const user = await this.userRepository.findById(userId)
    if (!user) throw new UserNotFoundError(userId)
    return user
  }

  private async auditCreated(user: User, source: string): Promise<void> {
    const event: AuditEvent = {
      userId: user.id,
      eventType: 'ACCOUNT_CREATED',
      occurredAt: new Date(),
      ipAddress: '0.0.0.0',
      deviceInfo: null,
      metadata: { source, role: user.role, createdBy: user.createdBy },
    }
    await this.auditService.log(event)
  }

  private async completeCreation(user: User, source: string): Promise<User> {
    try {
      await this.auditCreated(user, source)
      return user
    } catch (error) {
      await this.userRepository.delete(user.id)
      throw error
    }
  }
}
