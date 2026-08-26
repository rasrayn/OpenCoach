import { generateKeyPairSync } from 'crypto'
import * as fc from 'fast-check'
import { Role } from '../../../domain/value-objects/Role'
import { JwtTokenService } from '../JwtTokenService'

const { privateKey, publicKey } = generateKeyPairSync('rsa', { modulusLength: 2048 })

const basePayload = {
  sub: '00000000-0000-4000-8000-000000000001',
  role: Role.COACH,
  email: 'coach@example.com',
  emailVerified: true,
}

describe('JwtTokenService - access tokens RS256', () => {
  it('issues access tokens with unique jti and 15 minute expiration', () => {
    const now = Date.parse('2026-08-25T10:00:00.000Z')
    let jtiSequence = 0
    const service = new JwtTokenService({
      privateKey,
      publicKey,
      now: () => now,
      generateJti: () => `jti-${++jtiSequence}`,
    })

    const firstToken = service.issueAccessToken(basePayload)
    const secondToken = service.issueAccessToken(basePayload)

    const firstPayload = service.verifyAccessToken(firstToken)
    const secondPayload = service.verifyAccessToken(secondToken)

    expect(firstPayload).toEqual(
      expect.objectContaining({
        ...basePayload,
        iat: Math.floor(now / 1000),
        exp: Math.floor(now / 1000) + 900,
        jti: 'jti-1',
      })
    )
    expect(secondPayload.jti).toBe('jti-2')
    expect(secondPayload.jti).not.toBe(firstPayload.jti)
  })

  it('rejects expired access tokens', () => {
    let now = Date.parse('2026-08-25T10:00:00.000Z')
    const service = new JwtTokenService({ privateKey, publicKey, now: () => now })

    const token = service.issueAccessToken(basePayload)
    now += 900_000

    expect(() => service.verifyAccessToken(token)).toThrow('JWT expired')
  })

  it('rejects tokens whose payload has been tampered with', async () => {
    await fc.assert(
      fc.asyncProperty(fc.boolean(), async (emailVerified) => {
        const service = new JwtTokenService({ privateKey, publicKey })
        const token = service.issueAccessToken({ ...basePayload, emailVerified })
        const [header, payload, signature] = token.split('.')
        const decodedPayload = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
        const tamperedPayload = Buffer.from(
          JSON.stringify({ ...decodedPayload, emailVerified: !emailVerified }),
          'utf8'
        ).toString('base64url')

        expect(() => service.verifyAccessToken(`${header}.${tamperedPayload}.${signature}`)).toThrow(
          'Invalid JWT signature'
        )
      }),
      { numRuns: 50 }
    )
  })

  it('rejects signed tokens with roles outside the system enum', () => {
    const service = new JwtTokenService({ privateKey, publicKey })
    const token = service.issueAccessToken({ ...basePayload, role: 'ROOT' as Role })

    expect(() => service.verifyAccessToken(token)).toThrow('Invalid JWT payload')
  })

  it('rejects malformed tokens before trusting their content', () => {
    const service = new JwtTokenService({ privateKey, publicKey })

    expect(() => service.verifyAccessToken('not-a-jwt')).toThrow('Invalid JWT format')
  })
})
