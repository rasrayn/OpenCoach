/**
 * VerifyEmailUseCase — handles email address verification via a one-time token.
 * Implementation to be added in a later task.
 */
export interface IVerifyEmailUseCase {
  execute(verificationToken: string): Promise<void>
}
