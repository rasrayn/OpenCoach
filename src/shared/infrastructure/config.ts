/**
 * Application configuration loaded from environment variables.
 * All values have safe defaults for development.
 */

export interface AppConfig {
  port: number
  nodeEnv: string
  database: DatabaseConfig
  redis: RedisConfig
  jwt: JwtConfig
  email: EmailConfig
  cors: CorsConfig
}

export interface DatabaseConfig {
  host: string
  port: number
  name: string
  user: string
  password: string
}

export interface RedisConfig {
  host: string
  port: number
  password?: string
}

export interface JwtConfig {
  privateKeyPath: string
  publicKeyPath: string
  accessTokenExpiresInSeconds: number
}

export interface EmailConfig {
  host: string
  port: number
  user: string
  password: string
  fromAddress: string
}

export interface CorsConfig {
  allowedOrigins: string[]
}

export function loadConfig(): AppConfig {
  return {
    port: parseInt(process.env['PORT'] ?? '3000', 10),
    nodeEnv: process.env['NODE_ENV'] ?? 'development',
    database: {
      host: process.env['DB_HOST'] ?? 'localhost',
      port: parseInt(process.env['DB_PORT'] ?? '5432', 10),
      name: process.env['DB_NAME'] ?? 'auth_db',
      user: process.env['DB_USER'] ?? 'postgres',
      password: process.env['DB_PASSWORD'] ?? '',
    },
    redis: {
      host: process.env['REDIS_HOST'] ?? 'localhost',
      port: parseInt(process.env['REDIS_PORT'] ?? '6379', 10),
      password: process.env['REDIS_PASSWORD'],
    },
    jwt: {
      privateKeyPath: process.env['JWT_PRIVATE_KEY_PATH'] ?? './keys/private.pem',
      publicKeyPath: process.env['JWT_PUBLIC_KEY_PATH'] ?? './keys/public.pem',
      accessTokenExpiresInSeconds: 900, // 15 minutes
    },
    email: {
      host: process.env['EMAIL_HOST'] ?? 'localhost',
      port: parseInt(process.env['EMAIL_PORT'] ?? '1025', 10),
      user: process.env['EMAIL_USER'] ?? '',
      password: process.env['EMAIL_PASSWORD'] ?? '',
      fromAddress: process.env['EMAIL_FROM'] ?? 'noreply@example.com',
    },
    cors: {
      allowedOrigins: (process.env['CORS_ORIGINS'] ?? 'http://localhost:3001').split(','),
    },
  }
}
