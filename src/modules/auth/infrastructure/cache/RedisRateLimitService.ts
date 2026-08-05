import { IRateLimitService } from '../../application/ports/IRateLimitService'

/**
 * RedisRateLimitService — Redis implementation of IRateLimitService.
 * Full implementation added in Task 5.
 *
 * Redis key scheme:
 *   account_fail:{email}  — sliding counter (TTL: 10 min)
 *   account_block:{email} — block flag    (TTL: 900 s = 15 min)
 *   ip_fail:{ip}          — sliding counter (TTL: 5 min)
 *   ip_block:{ip}         — block flag    (TTL: 1800 s = 30 min)
 */
export class RedisRateLimitService implements IRateLimitService {
  async recordFailedAttempt(_accountKey: string): Promise<void> {
    throw new Error('Not implemented yet — see Task 5')
  }

  async isAccountBlocked(
    _accountKey: string
  ): Promise<{ blocked: boolean; remainingSeconds?: number }> {
    throw new Error('Not implemented yet — see Task 5')
  }

  async resetAccountAttempts(_accountKey: string): Promise<void> {
    throw new Error('Not implemented yet — see Task 5')
  }

  async recordIpAttempt(_ip: string): Promise<void> {
    throw new Error('Not implemented yet — see Task 5')
  }

  async isIpBlocked(
    _ip: string
  ): Promise<{ blocked: boolean; remainingSeconds?: number }> {
    throw new Error('Not implemented yet — see Task 5')
  }
}
