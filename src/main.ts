/**
 * main.ts — Composition Root
 *
 * This is the single place where all concrete implementations are instantiated
 * and wired together (Dependency Inversion Principle). No use-case or domain
 * class knows about these concrete implementations — they only depend on
 * interfaces defined in the domain and application layers.
 *
 * Full wiring is completed progressively as each task is implemented.
 */

import { loadConfig } from './shared/infrastructure/config'
import { logger } from './shared/infrastructure/logger'

// Infrastructure implementations
import { PostgresUserRepository, DbPool } from './modules/auth/infrastructure/persistence/PostgresUserRepository'
import { PostgresTokenRepository } from './modules/auth/infrastructure/persistence/PostgresTokenRepository'
import { PostgresAuditRepository } from './modules/auth/infrastructure/persistence/PostgresAuditRepository'
import { RedisRateLimitService } from './modules/auth/infrastructure/cache/RedisRateLimitService'
import { NodemailerEmailService } from './modules/auth/infrastructure/email/NodemailerEmailService'
import { BcryptPasswordHasher } from './modules/auth/infrastructure/security/BcryptPasswordHasher'
import { JwtTokenService } from './modules/auth/infrastructure/security/JwtTokenService'
import { AuditService } from './modules/auth/application/services/AuditService'

async function bootstrap(): Promise<void> {
  const config = loadConfig()

  logger.info('Starting application', { env: config.nodeEnv, port: config.port })

  // --- Database pool (replace with a real pg.Pool once pg is installed) ---
  // The DbPool interface is fulfilled here; at runtime the pool will throw
  // until a real pg.Pool instance is provided via environment configuration.
  const dbPool: DbPool = {
    query: async (_text: string, _values?: unknown[]) => {
      throw new Error('Database pool not initialised. Provide a real pg.Pool in production.')
    },
  }

  // --- Instantiate infrastructure adapters ---
  // (Wired up here; full implementations added in later tasks)
  const _userRepository = new PostgresUserRepository(dbPool)
  const _tokenRepository = new PostgresTokenRepository(dbPool)
  const _auditRepository = new PostgresAuditRepository(dbPool)
  const _auditService = new AuditService(_auditRepository)
  const _rateLimitService =
    config.nodeEnv === 'production'
      ? (() => {
          throw new Error('Production RateLimitService requires a shared atomic Redis store')
        })()
      : RedisRateLimitService.inMemoryForLocalDevelopment()
  const _emailService = new NodemailerEmailService()
  const _passwordHasher = new BcryptPasswordHasher()
  const _tokenSigner = new JwtTokenService()

  // --- Wire use-cases (Task 2+) ---
  // Use-cases will be instantiated and passed to controllers as tasks complete.

  // --- Start HTTP server (Task 14) ---
  logger.info('Composition Root initialised — HTTP server wiring added in Task 14')
}

bootstrap().catch((error: unknown) => {
  logger.error('Fatal error during startup', {
    error: error instanceof Error ? error.message : String(error),
  })
  process.exit(1)
})
