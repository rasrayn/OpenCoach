/**
 * CorsMiddleware — adds CORS headers to all authentication responses.
 *
 * Required headers per Requirement 11.3:
 *   Access-Control-Allow-Origin
 *   Access-Control-Allow-Methods
 *   Access-Control-Allow-Headers
 *   Access-Control-Allow-Credentials
 *
 * Full implementation in Task 14.
 */
export class CorsMiddleware {
  constructor(private readonly allowedOrigins: string[]) {}

  // Stub — full implementation in Task 14
  handle(_req: unknown, _res: unknown, _next: unknown): void {
    throw new Error('Not implemented yet — see Task 14')
  }
}
