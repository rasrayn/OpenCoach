/**
 * IEmailService — application port for sending transactional emails.
 * Concrete implementation lives in infrastructure/email/.
 */
export interface IEmailService {
  /**
   * Sends an email verification link to the given address.
   * @param to Recipient email address
   * @param verificationToken The opaque token to include in the verification link
   */
  sendVerificationEmail(to: string, verificationToken: string): Promise<void>

  /**
   * Sends an email containing the user's login credentials.
   * Used when an Admin creates a Coach, or a Coach creates an Athlete.
   */
  sendCredentialsEmail(
    to: string,
    credentials: { email: string; password: string }
  ): Promise<void>

  /**
   * Sends a password recovery link to the given address.
   * @param to Recipient email address
   * @param resetToken The opaque token to include in the reset link
   */
  sendPasswordResetEmail(to: string, resetToken: string): Promise<void>
}
