import { IRateLimitService } from '../../application/ports/IRateLimitService'

export interface RateLimitStore {
  recordAttempt(key: string, occurredAt: number, windowSeconds: number): Promise<number>
  setWithExpiry(key: string, value: string, seconds: number): Promise<void>
  ttl(key: string): Promise<number>
  delete(key: string): Promise<void>
}

interface StoreEntry {
  value: string
  expiresAt: number | null
}

class InMemoryRateLimitStore implements RateLimitStore {
  private readonly entries = new Map<string, StoreEntry>()
  private readonly attempts = new Map<string, number[]>()

  constructor(private readonly now: () => number) {}

  async recordAttempt(key: string, occurredAt: number, windowSeconds: number): Promise<number> {
    const windowStart = occurredAt - windowSeconds * 1000
    const activeAttempts = (this.attempts.get(key) ?? []).filter(
      (attemptAt) => attemptAt >= windowStart
    )
    activeAttempts.push(occurredAt)

    this.attempts.set(key, activeAttempts)

    return activeAttempts.length
  }

  async setWithExpiry(key: string, value: string, seconds: number): Promise<void> {
    this.entries.set(key, {
      value,
      expiresAt: this.now() + seconds * 1000,
    })
  }

  async ttl(key: string): Promise<number> {
    const current = this.getActiveEntry(key)
    if (!current) return -2
    if (current.expiresAt === null) return -1

    const remainingMs = current.expiresAt - this.now()
    if (remainingMs <= 0) {
      this.entries.delete(key)
      return -2
    }

    return Math.ceil(remainingMs / 1000)
  }

  async delete(key: string): Promise<void> {
    this.entries.delete(key)
    this.attempts.delete(key)
  }

  private getActiveEntry(key: string): StoreEntry | null {
    const current = this.entries.get(key)
    if (!current) return null

    if (current.expiresAt !== null && current.expiresAt <= this.now()) {
      this.entries.delete(key)
      return null
    }

    return current
  }
}

/**
 * RedisRateLimitService - IRateLimitService implementation for brute-force protection.
 *
 * The service depends on a tiny Redis-like store contract so production can inject
 * a real Redis adapter while tests and local development use the in-memory store.
 *
 * Redis key scheme:
 *   account_fail:{email}  - attempt timestamps inside a 10-minute sliding window
 *   account_block:{email} - block flag    (TTL: 900 s = 15 min)
 *   ip_fail:{ip}          - attempt timestamps inside a 5-minute sliding window
 *   ip_block:{ip}         - block flag    (TTL: 1800 s = 30 min)
 */
export class RedisRateLimitService implements IRateLimitService {
  static readonly ACCOUNT_FAILURE_WINDOW_SECONDS = 600
  static readonly ACCOUNT_BLOCK_SECONDS = 900
  static readonly ACCOUNT_FAILURE_THRESHOLD = 5

  static readonly IP_FAILURE_WINDOW_SECONDS = 300
  static readonly IP_BLOCK_SECONDS = 1800
  static readonly IP_FAILURE_THRESHOLD = 20

  private readonly store: RateLimitStore

  constructor(store?: RateLimitStore, private readonly now: () => number = Date.now) {
    this.store = store ?? new InMemoryRateLimitStore(now)
  }

  static inMemoryForTesting(now: () => number = Date.now): RedisRateLimitService {
    return new RedisRateLimitService(new InMemoryRateLimitStore(now), now)
  }

  async recordFailedAttempt(accountKey: string): Promise<void> {
    const attempts = await this.store.recordAttempt(
      this.accountFailKey(accountKey),
      this.now(),
      RedisRateLimitService.ACCOUNT_FAILURE_WINDOW_SECONDS
    )

    if (attempts >= RedisRateLimitService.ACCOUNT_FAILURE_THRESHOLD) {
      await this.store.setWithExpiry(
        this.accountBlockKey(accountKey),
        '1',
        RedisRateLimitService.ACCOUNT_BLOCK_SECONDS
      )
    }
  }

  async isAccountBlocked(
    accountKey: string
  ): Promise<{ blocked: boolean; remainingSeconds?: number }> {
    return this.blockStatus(this.accountBlockKey(accountKey))
  }

  async resetAccountAttempts(accountKey: string): Promise<void> {
    await this.store.delete(this.accountFailKey(accountKey))
  }

  async recordIpAttempt(ip: string): Promise<void> {
    const attempts = await this.store.recordAttempt(
      this.ipFailKey(ip),
      this.now(),
      RedisRateLimitService.IP_FAILURE_WINDOW_SECONDS
    )

    if (attempts >= RedisRateLimitService.IP_FAILURE_THRESHOLD) {
      await this.store.setWithExpiry(
        this.ipBlockKey(ip),
        '1',
        RedisRateLimitService.IP_BLOCK_SECONDS
      )
    }
  }

  async isIpBlocked(
    ip: string
  ): Promise<{ blocked: boolean; remainingSeconds?: number }> {
    return this.blockStatus(this.ipBlockKey(ip))
  }

  private async blockStatus(key: string): Promise<{ blocked: boolean; remainingSeconds?: number }> {
    const remainingSeconds = await this.store.ttl(key)
    if (remainingSeconds <= 0) return { blocked: false }

    return { blocked: true, remainingSeconds }
  }

  private accountFailKey(accountKey: string): string {
    return `account_fail:${accountKey}`
  }

  private accountBlockKey(accountKey: string): string {
    return `account_block:${accountKey}`
  }

  private ipFailKey(ip: string): string {
    return `ip_fail:${ip}`
  }

  private ipBlockKey(ip: string): string {
    return `ip_block:${ip}`
  }
}
