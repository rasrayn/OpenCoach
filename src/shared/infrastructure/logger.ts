/**
 * Minimal structured logger.
 * Can be swapped for winston, pino, etc. without changing call sites.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error'

export interface Logger {
  debug(message: string, meta?: Record<string, unknown>): void
  info(message: string, meta?: Record<string, unknown>): void
  warn(message: string, meta?: Record<string, unknown>): void
  error(message: string, meta?: Record<string, unknown>): void
}

class ConsoleLogger implements Logger {
  private formatEntry(
    level: LogLevel,
    message: string,
    meta?: Record<string, unknown>
  ): string {
    const entry: Record<string, unknown> = {
      timestamp: new Date().toISOString(),
      level,
      message,
      ...meta,
    }
    return JSON.stringify(entry)
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (process.env['NODE_ENV'] !== 'production') {
      console.debug(this.formatEntry('debug', message, meta))
    }
  }

  info(message: string, meta?: Record<string, unknown>): void {
    console.info(this.formatEntry('info', message, meta))
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    console.warn(this.formatEntry('warn', message, meta))
  }

  error(message: string, meta?: Record<string, unknown>): void {
    console.error(this.formatEntry('error', message, meta))
  }
}

export const logger: Logger = new ConsoleLogger()
