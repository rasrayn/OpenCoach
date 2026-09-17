import { createHash } from 'crypto'
import { EmailService } from '../EmailService'
import { IUserRepository } from '../../../domain/repositories/IUserRepository'
import { ITokenRepository } from '../../../domain/repositories/ITokenRepository'
import { IEmailService } from '../../ports/IEmailService'
import { EmailDeliveryError, UserNotFoundError } from '../../errors'
import { Role } from '../../../domain/value-objects/Role'

const now = new Date('2026-09-17T10:00:00Z')
function setup() {
  const users = { findById: jest.fn().mockResolvedValue({ id: 'user-1', email: 'user@example.com', role: Role.COACH }) }
  const tokens = {
    saveEmailVerificationToken: jest.fn().mockImplementation(async data => ({ ...data, id: 'verification-1', issuedAt: now })),
    savePasswordResetToken: jest.fn().mockImplementation(async data => ({ ...data, id: 'reset-1', issuedAt: now })),
    markEmailVerificationTokenUsed: jest.fn().mockResolvedValue(undefined),
    markPasswordResetTokenUsed: jest.fn().mockResolvedValue(undefined),
  }
  const delivery: jest.Mocked<IEmailService> = {
    sendVerificationEmail: jest.fn().mockResolvedValue(undefined),
    sendCredentialsEmail: jest.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: jest.fn().mockResolvedValue(undefined),
  }
  const service = new EmailService(users as unknown as IUserRepository, tokens as unknown as ITokenRepository, delivery, () => now)
  return { service, users, tokens, delivery }
}

describe('EmailService', () => {
  it.each(['verification', 'reset'] as const)('persists only the hash before sending a %s token, with the correct TTL', async kind => {
    const { service, tokens, delivery } = setup()
    const verification = kind === 'verification'
    const save = verification ? tokens.saveEmailVerificationToken : tokens.savePasswordResetToken
    const send = verification ? delivery.sendVerificationEmail : delivery.sendPasswordResetEmail
    await (verification ? service.sendVerificationEmail('user-1') : service.sendPasswordResetEmail('user-1'))
    const token = send.mock.calls[0][1]
    expect(token).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(save).toHaveBeenCalledWith({
      userId: 'user-1', usedAt: null,
      tokenHash: createHash('sha256').update(token).digest('hex'),
      expiresAt: new Date(now.getTime() + (verification ? 24 : 1) * 3600_000),
    })
    expect(JSON.stringify(save.mock.calls)).not.toContain(token)
    expect(send.mock.calls[0][0]).toBe('user@example.com')
    expect(save.mock.invocationCallOrder[0]).toBeLessThan(send.mock.invocationCallOrder[0])
  })

  it('generates distinct tokens across users and purposes', async () => {
    const { service, delivery } = setup()
    for (let i = 0; i < 100; i++) {
      await service.sendVerificationEmail('user-1')
      await service.sendPasswordResetEmail('user-1')
    }
    const values = [...delivery.sendVerificationEmail.mock.calls, ...delivery.sendPasswordResetEmail.mock.calls].map(call => call[1])
    expect(new Set(values).size).toBe(200)
  })

  it.each(['verification', 'reset'] as const)('invalidates the issued %s token after delivery failure', async kind => {
    const { service, tokens, delivery } = setup()
    const verification = kind === 'verification'
    const send = verification ? delivery.sendVerificationEmail : delivery.sendPasswordResetEmail
    send.mockRejectedValue(new Error('SMTP response containing private message'))
    await expect(verification ? service.sendVerificationEmail('user-1') : service.sendPasswordResetEmail('user-1')).rejects.toThrow(EmailDeliveryError)
    expect(verification ? tokens.markEmailVerificationTokenUsed : tokens.markPasswordResetTokenUsed).toHaveBeenCalledWith(verification ? 'verification-1' : 'reset-1')
  })

  it.each(['verification', 'reset'] as const)('does not send %s mail if persistence fails', async kind => {
    const { service, tokens, delivery } = setup()
    const verification = kind === 'verification'
    const save = verification ? tokens.saveEmailVerificationToken : tokens.savePasswordResetToken
    save.mockRejectedValue(new Error('database unavailable'))
    await expect(verification ? service.sendVerificationEmail('user-1') : service.sendPasswordResetEmail('user-1')).rejects.toThrow('database unavailable')
    expect(delivery.sendVerificationEmail).not.toHaveBeenCalled()
    expect(delivery.sendPasswordResetEmail).not.toHaveBeenCalled()
  })

  it('rejects missing users without persisting or sending anything', async () => {
    const { service, users, tokens, delivery } = setup()
    users.findById.mockResolvedValue(null)
    await expect(service.sendVerificationEmail('missing')).rejects.toThrow(UserNotFoundError)
    await expect(service.sendPasswordResetEmail('missing')).rejects.toThrow(UserNotFoundError)
    await expect(service.sendCredentialsEmail('missing', 'Secret1!')).rejects.toThrow(UserNotFoundError)
    expect(tokens.saveEmailVerificationToken).not.toHaveBeenCalled()
    expect(tokens.savePasswordResetToken).not.toHaveBeenCalled()
    Object.values(delivery).forEach(send => expect(send).not.toHaveBeenCalled())
  })

  it('delivers credentials to the stored address without persisting the password', async () => {
    const { service, delivery, tokens } = setup()
    await service.sendCredentialsEmail('user-1', 'Secret1!')
    expect(delivery.sendCredentialsEmail).toHaveBeenCalledWith('user@example.com', { email: 'user@example.com', password: 'Secret1!' })
    Object.values(tokens).forEach(operation => expect(operation).not.toHaveBeenCalled())
  })
})
