/**
 * RevokeSessionsUseCase — revokes all active sessions for a user.
 * Implementation to be added in a later task.
 */
export interface IRevokeSessionsUseCase {
  execute(userId: string): Promise<void>
}
