import nodemailer, { SendMailOptions } from 'nodemailer'
import { NodemailerEmailService } from '../NodemailerEmailService'
import { EmailDeliveryError, EmailDeliveryTimeoutError } from '../../../application/errors'
import { EmailConfig } from '../../../../../shared/infrastructure/config'

const config: EmailConfig = {
  host: 'smtp.example.com', port: 587, user: 'smtp-user', password: 'smtp-secret',
  fromAddress: 'noreply@example.com',
  verificationBaseUrl: 'https://api.example.com/auth/email/verify',
  passwordResetBaseUrl: 'https://app.example.com/password/reset/',
}
const token = 'a'.repeat(43)
function setup(overrides: Partial<EmailConfig> = {}, environment = 'production') {
  const transport = {
    sendMail: jest.fn().mockResolvedValue({ accepted: ['user@example.com'], rejected: [] }),
    close: jest.fn(),
  }
  const factory = jest.fn(() => transport)
  const service = new NodemailerEmailService({ ...config, ...overrides }, environment, factory)
  return { service, factory, transport }
}

describe('NodemailerEmailService', () => {
  afterEach(() => jest.useRealTimers())

  it('renders verification and reset links using configured URLs and exact opaque tokens', async () => {
    const { service, transport } = setup()
    await service.sendVerificationEmail('User@Example.com', token)
    await service.sendPasswordResetEmail('User@Example.com', token)
    const messages = transport.sendMail.mock.calls.map(call => call[0])
    expect(messages[0].text).toContain(`https://api.example.com/auth/email/verify/${token}`)
    expect(messages[0].text).toContain('24 horas')
    expect(messages[1].text).toContain(`https://app.example.com/password/reset/${token}`)
    expect(messages[1].text).toContain('1 hora')
    expect(messages[0].envelope).toEqual({ from: 'noreply@example.com', to: ['user@example.com'] })
    expect(transport.close).toHaveBeenCalledTimes(2)
  })

  it('sends credentials as plain text without interpreting password markup', async () => {
    const { service, transport } = setup()
    await service.sendCredentialsEmail('user@example.com', { email: 'user@example.com', password: '<Secret1&>' })
    const message = transport.sendMail.mock.calls[0][0]
    expect(message.text).toContain('Contraseña: <Secret1&>')
    expect(message.html).toBeUndefined()
    expect(message.subject).not.toContain('<Secret1&>')
  })

  it('enforces TLS, disables content access and debug logs, and bounds SMTP waits', async () => {
    const { service, factory } = setup()
    await service.sendVerificationEmail('user@example.com', token)
    expect(factory).toHaveBeenCalledWith(expect.objectContaining({
      requireTLS: true, secure: false, logger: false, debug: false,
      tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      disableFileAccess: true, disableUrlAccess: true,
      connectionTimeout: 10_000, socketTimeout: 30_000,
    }))
  })

  it('supports implicit TLS on port 465 and a local development SMTP sink', async () => {
    const implicit = setup({ port: 465 })
    await implicit.service.sendVerificationEmail('user@example.com', token)
    expect(implicit.factory).toHaveBeenCalledWith(expect.objectContaining({ secure: true, requireTLS: true }))
    const local = setup({ host: 'localhost', port: 1025, user: '', password: '', verificationBaseUrl: 'http://localhost:3000/auth/email/verify' }, 'development')
    await local.service.sendVerificationEmail('user@example.com', token)
    expect(local.factory).toHaveBeenCalledWith(expect.objectContaining({ secure: false, requireTLS: false, auth: undefined }))
  })

  it.each(['http://example.com/verify', 'http://localhost/verify', 'https://user:pass@example.com/verify', 'https://example.com/?token=x', 'file:///tmp/verify'])('rejects unsafe production URL %s', url => {
    expect(() => setup({ verificationBaseUrl: url })).toThrow()
  })

  it.each(['user@example.com\r\nBcc: victim@example.com', 'user@example.com,victim@example.com', 'User <user@example.com>'])('rejects recipient injection', async recipient => {
    const { service, factory } = setup()
    await expect(service.sendVerificationEmail(recipient, token)).rejects.toThrow()
    expect(factory).not.toHaveBeenCalled()
  })

  it('rejects mismatched credentials and malformed tokens without sending', async () => {
    const { service, factory } = setup()
    await expect(service.sendCredentialsEmail('other@example.com', { email: 'user@example.com', password: 'Secret1!' })).rejects.toThrow()
    await expect(service.sendVerificationEmail('user@example.com', '../?leak')).rejects.toThrow()
    expect(factory).not.toHaveBeenCalled()
  })

  it('reports SMTP rejection and sanitizes provider errors', async () => {
    const { service, transport } = setup()
    transport.sendMail.mockResolvedValueOnce({ accepted: [], rejected: ['user@example.com'] })
    await expect(service.sendVerificationEmail('user@example.com', token)).rejects.toThrow(EmailDeliveryError)
    transport.sendMail.mockRejectedValueOnce(new Error('smtp-secret private message'))
    await expect(service.sendVerificationEmail('user@example.com', token)).rejects.toThrow('Email delivery failed')
    expect(transport.close).toHaveBeenCalledTimes(2)
  })

  it('fails a hung send after 60 seconds and closes the transport', async () => {
    jest.useFakeTimers()
    const { service, transport } = setup()
    transport.sendMail.mockImplementation(() => new Promise(() => undefined))
    const result = expect(service.sendCredentialsEmail('user@example.com', { email: 'user@example.com', password: 'Secret1!' })).rejects.toThrow(EmailDeliveryTimeoutError)
    await jest.advanceTimersByTimeAsync(60_000)
    await result
    expect(transport.close).toHaveBeenCalledTimes(1)
    expect(jest.getTimerCount()).toBe(0)
  })

  it('builds a real MIME message with Nodemailer without contacting SMTP', async () => {
    const messages: string[] = []
    const stream = nodemailer.createTransport({ streamTransport: true, buffer: true, newline: 'unix' })
    const service = new NodemailerEmailService(config, 'production', () => ({
      async sendMail(message: SendMailOptions) {
        const result = await stream.sendMail(message)
        messages.push(result.message.toString())
        return { accepted: ['user@example.com'], rejected: [] }
      },
      close: () => stream.close(),
    }))
    await service.sendCredentialsEmail('user@example.com', { email: 'user@example.com', password: 'Secret1!' })
    expect(messages[0]).toContain('To: user@example.com')
    expect(messages[0]).toContain('Content-Type: text/plain')
    expect(messages[0]).toContain('Secret1!')
    expect(messages[0]).not.toContain('smtp-secret')
  })
})
