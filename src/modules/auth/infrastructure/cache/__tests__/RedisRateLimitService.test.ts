import * as fc from 'fast-check'
import { RedisRateLimitService } from '../RedisRateLimitService'

describe('RedisRateLimitService - account blocking (Propiedad 7)', () => {
  it('blocks the account exactly after 5 failed attempts within 10 minutes', async () => {
    await fc.assert(
      fc.asyncProperty(fc.emailAddress(), async (email) => {
        let now = 0
        const service = RedisRateLimitService.inMemoryForTesting(() => now)

        for (let attempt = 1; attempt < RedisRateLimitService.ACCOUNT_FAILURE_THRESHOLD; attempt++) {
          await service.recordFailedAttempt(email)
          expect(await service.isAccountBlocked(email)).toEqual({ blocked: false })

          now += 1_000
        }

        await service.recordFailedAttempt(email)
        const blocked = await service.isAccountBlocked(email)

        expect(blocked.blocked).toBe(true)
        expect(blocked.remainingSeconds).toBe(RedisRateLimitService.ACCOUNT_BLOCK_SECONDS)
      }),
      { numRuns: 100 }
    )
  })

  it('blocks when 5 account attempts happen inside the same 10-minute window', async () => {
    const attemptOffsetsInsideWindowArb = fc
      .array(fc.integer({ min: 0, max: RedisRateLimitService.ACCOUNT_FAILURE_WINDOW_SECONDS - 1 }), {
        minLength: RedisRateLimitService.ACCOUNT_FAILURE_THRESHOLD - 1,
        maxLength: RedisRateLimitService.ACCOUNT_FAILURE_THRESHOLD - 1,
      })
      .map((offsets) => offsets.sort((a, b) => a - b))

    await fc.assert(
      fc.asyncProperty(fc.emailAddress(), attemptOffsetsInsideWindowArb, async (email, offsets) => {
        let now = 0
        const service = RedisRateLimitService.inMemoryForTesting(() => now)

        await service.recordFailedAttempt(email)
        expect((await service.isAccountBlocked(email)).blocked).toBe(false)

        for (const secondsFromFirstAttempt of offsets.slice(0, -1)) {
          now = secondsFromFirstAttempt * 1000
          await service.recordFailedAttempt(email)
          expect((await service.isAccountBlocked(email)).blocked).toBe(false)
        }

        now = offsets[offsets.length - 1] * 1000
        await service.recordFailedAttempt(email)
        expect((await service.isAccountBlocked(email)).blocked).toBe(true)
      }),
      { numRuns: 100 }
    )
  })

  it('does not count account attempts that expired outside the 10-minute window', async () => {
    let now = 0
    const email = 'window-reset@example.com'
    const service = RedisRateLimitService.inMemoryForTesting(() => now)

    for (let attempt = 0; attempt < RedisRateLimitService.ACCOUNT_FAILURE_THRESHOLD - 1; attempt++) {
      await service.recordFailedAttempt(email)
      now += 60_000
    }

    now += (RedisRateLimitService.ACCOUNT_FAILURE_WINDOW_SECONDS + 1) * 1000

    await service.recordFailedAttempt(email)

    expect(await service.isAccountBlocked(email)).toEqual({ blocked: false })
  })

  it('does not block when account attempts are individually close but not in the same 10-minute window', async () => {
    let now = 0
    const email = 'spread-attempts@example.com'
    const service = RedisRateLimitService.inMemoryForTesting(() => now)

    for (let attempt = 0; attempt < RedisRateLimitService.ACCOUNT_FAILURE_THRESHOLD; attempt++) {
      await service.recordFailedAttempt(email)
      now += (RedisRateLimitService.ACCOUNT_FAILURE_WINDOW_SECONDS - 1) * 1000
    }

    expect(await service.isAccountBlocked(email)).toEqual({ blocked: false })
  })

  it('unblocks the account after the 15-minute block TTL expires', async () => {
    let now = 0
    const email = 'athlete@example.com'
    const service = RedisRateLimitService.inMemoryForTesting(() => now)

    for (let attempt = 0; attempt < RedisRateLimitService.ACCOUNT_FAILURE_THRESHOLD; attempt++) {
      await service.recordFailedAttempt(email)
    }

    expect((await service.isAccountBlocked(email)).blocked).toBe(true)

    now += RedisRateLimitService.ACCOUNT_BLOCK_SECONDS * 1000

    expect(await service.isAccountBlocked(email)).toEqual({ blocked: false })
  })

  it('resets account failed attempts after successful authentication', async () => {
    let now = 0
    const email = 'coach@example.com'
    const service = RedisRateLimitService.inMemoryForTesting(() => now)

    for (let attempt = 0; attempt < RedisRateLimitService.ACCOUNT_FAILURE_THRESHOLD - 1; attempt++) {
      await service.recordFailedAttempt(email)
    }

    await service.resetAccountAttempts(email)

    for (let attempt = 0; attempt < RedisRateLimitService.ACCOUNT_FAILURE_THRESHOLD - 1; attempt++) {
      await service.recordFailedAttempt(email)
    }

    expect(await service.isAccountBlocked(email)).toEqual({ blocked: false })
  })
})

describe('RedisRateLimitService - IP blocking (Propiedad 23)', () => {
  const ipAddressArb = fc
    .tuple(
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 }),
      fc.integer({ min: 0, max: 255 })
    )
    .map((octets) => octets.join('.'))

  it('blocks the IP exactly after 20 failed attempts within 5 minutes', async () => {
    await fc.assert(
      fc.asyncProperty(ipAddressArb, async (ip) => {
        let now = 0
        const service = RedisRateLimitService.inMemoryForTesting(() => now)

        for (let attempt = 1; attempt < RedisRateLimitService.IP_FAILURE_THRESHOLD; attempt++) {
          await service.recordIpAttempt(ip)
          expect(await service.isIpBlocked(ip)).toEqual({ blocked: false })

          now += 1_000
        }

        await service.recordIpAttempt(ip)
        const blocked = await service.isIpBlocked(ip)

        expect(blocked.blocked).toBe(true)
        expect(blocked.remainingSeconds).toBe(RedisRateLimitService.IP_BLOCK_SECONDS)
      }),
      { numRuns: 100 }
    )
  })

  it('unblocks the IP after the 30-minute block TTL expires', async () => {
    let now = 0
    const ip = '203.0.113.10'
    const service = RedisRateLimitService.inMemoryForTesting(() => now)

    for (let attempt = 0; attempt < RedisRateLimitService.IP_FAILURE_THRESHOLD; attempt++) {
      await service.recordIpAttempt(ip)
    }

    expect((await service.isIpBlocked(ip)).blocked).toBe(true)

    now += RedisRateLimitService.IP_BLOCK_SECONDS * 1000

    expect(await service.isIpBlocked(ip)).toEqual({ blocked: false })
  })

  it('does not block when IP attempts are individually close but not in the same 5-minute window', async () => {
    let now = 0
    const ip = '203.0.113.20'
    const service = RedisRateLimitService.inMemoryForTesting(() => now)

    for (let attempt = 0; attempt < RedisRateLimitService.IP_FAILURE_THRESHOLD; attempt++) {
      await service.recordIpAttempt(ip)
      now += (RedisRateLimitService.IP_FAILURE_WINDOW_SECONDS - 1) * 1000
    }

    expect(await service.isIpBlocked(ip)).toEqual({ blocked: false })
  })
})
