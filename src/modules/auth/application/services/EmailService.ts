import { createHash, randomBytes } from 'crypto'
import { IUserRepository } from '../../domain/repositories/IUserRepository'
import { ITokenRepository } from '../../domain/repositories/ITokenRepository'
import { IEmailService } from '../ports/IEmailService'
import { IAccountEmailService } from '../ports/IAccountEmailService'
import { EmailDeliveryError, UserNotFoundError } from '../errors'

/** Issues account email tokens; the delivery port only renders and sends them. */
export class EmailService implements IAccountEmailService {
  constructor(
    private readonly users: IUserRepository,
    private readonly tokens: ITokenRepository,
    private readonly delivery: IEmailService,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async sendVerificationEmail(userId: string): Promise<void> {
    const user = await this.requireUser(userId)
    const token = randomBytes(32).toString('base64url')
    const record = await this.tokens.saveEmailVerificationToken({
      userId: user.id, tokenHash: this.hash(token),
      expiresAt: new Date(this.now().getTime() + 24 * 60 * 60 * 1000), usedAt: null,
    })
    try {
      await this.delivery.sendVerificationEmail(user.email, token)
    } catch {
      await this.tokens.markEmailVerificationTokenUsed(record.id)
      throw new EmailDeliveryError()
    }
  }

  async sendCredentialsEmail(userId: string, password: string): Promise<void> {
    const user = await this.requireUser(userId)
    // Initial password supplied by the creation flow; never persisted here.
    await this.delivery.sendCredentialsEmail(user.email, { email: user.email, password })
  }

  async sendPasswordResetEmail(userId: string): Promise<void> {
    const user = await this.requireUser(userId)
    const token = randomBytes(32).toString('base64url')
    const record = await this.tokens.savePasswordResetToken({
      userId: user.id, tokenHash: this.hash(token),
      expiresAt: new Date(this.now().getTime() + 60 * 60 * 1000), usedAt: null,
    })
    try {
      await this.delivery.sendPasswordResetEmail(user.email, token)
    } catch {
      await this.tokens.markPasswordResetTokenUsed(record.id)
      throw new EmailDeliveryError()
    }
  }

  private async requireUser(userId: string) {
    const user = await this.users.findById(userId)
    if (!user) throw new UserNotFoundError(userId)
    return user
  }

  private hash(token: string): string {
    return createHash('sha256').update(token).digest('hex')
  }
}
