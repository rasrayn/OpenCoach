import { createSign, createVerify, KeyObject, randomUUID } from 'crypto'
import { readFileSync } from 'fs'
import { TokenPayload } from '../../application/dtos'
import { ITokenSigner } from '../../domain/services/ITokenSigner'
import { isValidRole } from '../../domain/value-objects/Role'
import { loadConfig } from '../../../../shared/infrastructure/config'

type JwtAlgorithm = 'RS256'

interface JwtHeader {
  alg: JwtAlgorithm
  typ: 'JWT'
}

export interface JwtTokenServiceOptions {
  privateKey?: string | Buffer | KeyObject
  publicKey?: string | Buffer | KeyObject
  privateKeyPath?: string
  publicKeyPath?: string
  accessTokenExpiresInSeconds?: number
  now?: () => number
  generateJti?: () => string
}

/**
 * RS256 JWT implementation.
 *
 * Private/public keys are injected directly in tests and loaded from paths in
 * runtime configuration. Key material must stay outside Git.
 */
export class JwtTokenService implements ITokenSigner {
  private readonly privateKey: string | Buffer | KeyObject
  private readonly publicKey: string | Buffer | KeyObject
  private readonly accessTokenExpiresInSeconds: number
  private readonly now: () => number
  private readonly generateJti: () => string

  constructor(options: JwtTokenServiceOptions = {}) {
    const config = loadConfig()

    this.privateKey =
      options.privateKey ??
      readFileSync(options.privateKeyPath ?? config.jwt.privateKeyPath)
    this.publicKey =
      options.publicKey ??
      readFileSync(options.publicKeyPath ?? config.jwt.publicKeyPath)
    this.accessTokenExpiresInSeconds =
      options.accessTokenExpiresInSeconds ?? config.jwt.accessTokenExpiresInSeconds
    this.now = options.now ?? Date.now
    this.generateJti = options.generateJti ?? randomUUID
  }

  sign(payload: Omit<TokenPayload, 'iat' | 'exp' | 'jti'>): string {
    const issuedAt = Math.floor(this.now() / 1000)
    const tokenPayload: TokenPayload = {
      ...payload,
      iat: issuedAt,
      exp: issuedAt + this.accessTokenExpiresInSeconds,
      jti: this.generateJti(),
    }

    const header = encodeJson({ alg: 'RS256', typ: 'JWT' } satisfies JwtHeader)
    const body = encodeJson(tokenPayload)
    const signingInput = `${header}.${body}`

    return `${signingInput}.${this.signInput(signingInput)}`
  }

  verify(token: string): TokenPayload {
    const parts = token.split('.')
    if (parts.length !== 3) {
      throw new Error('Invalid JWT format')
    }

    const [encodedHeader, encodedPayload, encodedSignature] = parts
    const header = decodeJson<Partial<JwtHeader>>(encodedHeader)
    if (header.alg !== 'RS256' || header.typ !== 'JWT') {
      throw new Error('Invalid JWT header')
    }

    const signingInput = `${encodedHeader}.${encodedPayload}`
    const verifier = createVerify('RSA-SHA256')
    verifier.update(signingInput)
    verifier.end()

    if (!verifier.verify(this.publicKey, fromBase64Url(encodedSignature))) {
      throw new Error('Invalid JWT signature')
    }

    const payload = decodeJson<TokenPayload>(encodedPayload)
    assertTokenPayload(payload)

    if (payload.exp <= Math.floor(this.now() / 1000)) {
      throw new Error('JWT expired')
    }

    return payload
  }

  issueAccessToken(payload: Omit<TokenPayload, 'iat' | 'exp' | 'jti'>): string {
    return this.sign(payload)
  }

  verifyAccessToken(token: string): TokenPayload {
    return this.verify(token)
  }

  private signInput(signingInput: string): string {
    const signer = createSign('RSA-SHA256')
    signer.update(signingInput)
    signer.end()

    return toBase64Url(signer.sign(this.privateKey))
  }
}

function encodeJson(value: unknown): string {
  return toBase64Url(Buffer.from(JSON.stringify(value), 'utf8'))
}

function decodeJson<T>(value: string): T {
  try {
    return JSON.parse(fromBase64Url(value).toString('utf8')) as T
  } catch {
    throw new Error('Invalid JWT JSON')
  }
}

function toBase64Url(value: Buffer): string {
  return value
    .toString('base64')
    .replace(/=/g, '')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
}

function fromBase64Url(value: string): Buffer {
  return Buffer.from(value.replace(/-/g, '+').replace(/_/g, '/'), 'base64')
}

function assertTokenPayload(payload: TokenPayload): void {
  if (
    typeof payload.sub !== 'string' ||
    !isValidRole(payload.role) ||
    typeof payload.email !== 'string' ||
    typeof payload.emailVerified !== 'boolean' ||
    typeof payload.iat !== 'number' ||
    typeof payload.exp !== 'number' ||
    typeof payload.jti !== 'string'
  ) {
    throw new Error('Invalid JWT payload')
  }
}
