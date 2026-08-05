/**
 * IRateLimitService — application port for brute-force protection.
 * Concrete implementation lives in infrastructure/cache/.
 */
export interface IRateLimitService {
  // ── Account-level rate limiting ───────────────────────────────────────────

  /**
   * Increments the failed attempt counter for the given account key (email).
   * Activates a 15-minute block after the 5th attempt within 10 minutes.
   */
  recordFailedAttempt(accountKey: string): Promise<void>

  /**
   * Returns whether the account is currently blocked.
   * If blocked, also returns the remaining lock time in seconds.
   */
  isAccountBlocked(
    accountKey: string
  ): Promise<{ blocked: boolean; remainingSeconds?: number }>

  /**
   * Resets the failed-attempt counter for the given account key after a
   * successful authentication.
   */
  resetAccountAttempts(accountKey: string): Promise<void>

  // ── IP-level rate limiting ────────────────────────────────────────────────

  /**
   * Increments the failed attempt counter for the given IP address.
   * Activates a 30-minute block after 20 attempts within 5 minutes.
   */
  recordIpAttempt(ip: string): Promise<void>

  /**
   * Returns whether the IP is currently blocked.
   * If blocked, also returns the remaining lock time in seconds.
   */
  isIpBlocked(
    ip: string
  ): Promise<{ blocked: boolean; remainingSeconds?: number }>
}
