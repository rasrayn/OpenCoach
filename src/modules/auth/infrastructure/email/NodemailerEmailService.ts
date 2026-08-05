import { IEmailService } from '../../application/ports/IEmailService'

/**
 * NodemailerEmailService — Nodemailer implementation of IEmailService.
 * Full implementation added in Task 10.
 */
export class NodemailerEmailService implements IEmailService {
  async sendVerificationEmail(
    _to: string,
    _verificationToken: string
  ): Promise<void> {
    throw new Error('Not implemented yet — see Task 10')
  }

  async sendCredentialsEmail(
    _to: string,
    _credentials: { email: string; password: string }
  ): Promise<void> {
    throw new Error('Not implemented yet — see Task 10')
  }

  async sendPasswordResetEmail(_to: string, _resetToken: string): Promise<void> {
    throw new Error('Not implemented yet — see Task 10')
  }
}
