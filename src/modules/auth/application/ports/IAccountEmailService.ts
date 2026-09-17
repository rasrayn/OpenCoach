/** Account-level orchestration. Recipients are resolved from persisted users. */
export interface IAccountEmailService {
  sendVerificationEmail(userId: string): Promise<void>
  sendCredentialsEmail(userId: string, password: string): Promise<void>
  sendPasswordResetEmail(userId: string): Promise<void>
}
