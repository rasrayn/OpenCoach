/**
 * RedisTokenCache — optional Redis cache layer for token lookups.
 * Full implementation added in Task 7 if required for performance.
 */
export class RedisTokenCache {
  async get(_key: string): Promise<string | null> {
    throw new Error('Not implemented yet — see Task 7')
  }

  async set(_key: string, _value: string, _ttlSeconds: number): Promise<void> {
    throw new Error('Not implemented yet — see Task 7')
  }

  async del(_key: string): Promise<void> {
    throw new Error('Not implemented yet — see Task 7')
  }
}
