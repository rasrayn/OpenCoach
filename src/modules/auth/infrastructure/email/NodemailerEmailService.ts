import nodemailer, { SendMailOptions } from 'nodemailer'
import SMTPPool from 'nodemailer/lib/smtp-pool'
import { IEmailService } from '../../application/ports/IEmailService'
import { EmailDeliveryError, EmailDeliveryTimeoutError } from '../../application/errors'
import { EmailConfig } from '../../../../shared/infrastructure/config'
import { ValidationError } from '../../../../shared/domain/errors'

export interface EmailTransport {
  sendMail(message: SendMailOptions): Promise<{ accepted: unknown[]; rejected: unknown[] }>
  close(): void
}
export type EmailTransportFactory = (options: SMTPPool.Options) => EmailTransport

/** SMTP delivery only. Token issuance belongs to the application EmailService. */
export class NodemailerEmailService implements IEmailService {
  static readonly DELIVERY_TIMEOUT_MS = 60_000
  private readonly from: string
  private readonly verificationUrl: URL
  private readonly resetUrl: URL
  private readonly smtpOptions: SMTPPool.Options

  constructor(
    config: EmailConfig,
    nodeEnv: string,
    private readonly createTransport: EmailTransportFactory = options => nodemailer.createTransport(options),
  ) {
    this.from = this.address(config.fromAddress)
    this.verificationUrl = this.baseUrl(config.verificationBaseUrl, nodeEnv)
    this.resetUrl = this.baseUrl(config.passwordResetBaseUrl, nodeEnv)
    if (!config.host || !Number.isInteger(config.port) || config.port < 1 || config.port > 65535 ||
        Boolean(config.user) !== Boolean(config.password)) {
      throw new ValidationError('Invalid SMTP configuration')
    }
    const local = nodeEnv !== 'production' && ['localhost', '127.0.0.1', '::1'].includes(config.host)
    this.smtpOptions = {
      host: config.host, port: config.port, secure: config.port === 465,
      requireTLS: !local, tls: { minVersion: 'TLSv1.2', rejectUnauthorized: true },
      auth: config.user ? { user: config.user, pass: config.password } : undefined,
      pool: true, maxConnections: 1, maxMessages: 1,
      connectionTimeout: 10_000, greetingTimeout: 10_000, socketTimeout: 30_000,
      dnsTimeout: 10_000, logger: false, debug: false,
      disableFileAccess: true, disableUrlAccess: true,
    }
  }

  async sendVerificationEmail(to: string, token: string): Promise<void> {
    await this.send(to, 'Verifica tu email en OpenCoach',
      `Verifica tu dirección de email (enlace válido durante 24 horas):\n${this.link(this.verificationUrl, token)}`)
  }

  async sendCredentialsEmail(to: string, credentials: { email: string; password: string }): Promise<void> {
    if (this.address(to) !== this.address(credentials.email) ||
        typeof credentials.password !== 'string' || !credentials.password) {
      throw new ValidationError('Invalid credentials email')
    }
    await this.send(to, 'Tus credenciales de OpenCoach',
      `Tu cuenta está creada.\nEmail: ${this.address(credentials.email)}\nContraseña: ${credentials.password}\n\nTe recomendamos cambiar la contraseña en tu primer acceso.`)
  }

  async sendPasswordResetEmail(to: string, token: string): Promise<void> {
    await this.send(to, 'Recupera tu contraseña de OpenCoach',
      `Establece una nueva contraseña (enlace válido durante 1 hora):\n${this.link(this.resetUrl, token)}\n\nSi no lo has solicitado, ignora este mensaje.`)
  }

  private async send(to: string, subject: string, text: string): Promise<void> {
    const recipient = this.address(to)
    let transport: EmailTransport | undefined
    let timer: ReturnType<typeof setTimeout> | undefined
    try {
      transport = this.createTransport(this.smtpOptions)
      const timeout = new Promise<never>((_resolve, reject) => {
        timer = setTimeout(() => reject(new EmailDeliveryTimeoutError()), NodemailerEmailService.DELIVERY_TIMEOUT_MS)
      })
      const result = await Promise.race([
        transport.sendMail({
          from: { name: 'OpenCoach', address: this.from },
          to: { name: '', address: recipient },
          envelope: { from: this.from, to: [recipient] }, subject, text,
          disableFileAccess: true, disableUrlAccess: true,
        }),
        timeout,
      ])
      if (result.accepted.length !== 1 || result.rejected.length !== 0) throw new EmailDeliveryError()
    } catch (error) {
      if (error instanceof EmailDeliveryTimeoutError) throw error
      throw new EmailDeliveryError()
    } finally {
      if (timer) clearTimeout(timer)
      transport?.close()
    }
  }

  private address(value: string): string {
    // One bare mailbox only: no display names, recipient lists or header controls.
    if (typeof value !== 'string' || !/^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9-]+(?:\.[a-zA-Z0-9-]+)+$/.test(value)) {
      throw new ValidationError('Invalid email address')
    }
    return value.toLowerCase()
  }

  private baseUrl(value: string, nodeEnv: string): URL {
    let url: URL
    try { url = new URL(value) } catch { throw new ValidationError('Invalid email link URL') }
    const local = nodeEnv !== 'production' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)
    if ((url.protocol !== 'https:' && !(local && url.protocol === 'http:')) || url.username || url.password || url.search || url.hash) {
      throw new ValidationError('Email links require HTTPS (HTTP loopback allowed in development)')
    }
    return url
  }

  private link(base: URL, token: string): string {
    if (!/^[A-Za-z0-9_-]{43}$/.test(token)) throw new ValidationError('Invalid email token')
    const url = new URL(base.href)
    url.pathname = `${url.pathname.replace(/\/$/, '')}/${token}`
    return url.href
  }
}
