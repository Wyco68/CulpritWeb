import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';
import { logger } from './logger';

// Prisma is imported ONLY here and in repositories. Singleton to survive HMR / serverless reuse.
// Prisma 7 requires a driver adapter; Neon's serverless driver works over HTTP/WebSocket,
// which is what makes this viable on Vercel's serverless/edge runtimes.
//
// Neon suspends its compute after ~5 minutes of inactivity, and the WebSocket-based `Pool` the
// adapter holds internally is a long-lived object tied to this module-level singleton. When the
// underlying socket drops during an idle period, the *next* query grabbed from the pool fails
// immediately — before any SQL reaches the wire, hence no `prisma:query` log line — surfacing as
// an opaque 500. The adapter itself can't transparently recover from this (a dead socket errors
// once and is evicted from the pool), so we retry the query once: the pool hands the retry a
// freshly-dialed connection, which succeeds. `onPoolError`/`onConnectionError` also give us
// visibility into these background failures instead of them being swallowed by the driver.
const adapter = new PrismaNeon(
  { connectionString: process.env.DATABASE_URL },
  {
    onPoolError: (err) => logger.warn('prisma_neon_pool_error', { message: err.message }),
    onConnectionError: (err) => logger.warn('prisma_neon_connection_error', { message: err.message }),
  },
);

const basePrismaClient = new PrismaClient({
  adapter,
  log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
});

/** Messages/codes that indicate a stale/dropped connection rather than a real query failure. */
const RETRYABLE_PATTERNS = [
  /connection terminated/i,
  /connection.*closed/i,
  /econnreset/i,
  /socket hang up/i,
  /websocket.*not open/i,
  /terminating connection/i,
  /server closed the connection/i,
  /(^|\W)P1001(\W|$)/, // Prisma: "Can't reach database server"
  /(^|\W)P1017(\W|$)/, // Prisma: "Server has closed the connection"
];

function isRetryableConnectionError(error: unknown): boolean {
  const message = error instanceof Error ? `${error.message} ${String(error.cause ?? '')}` : String(error);
  return RETRYABLE_PATTERNS.some((pattern) => pattern.test(message));
}

/**
 * Extend the client with a one-shot retry for transient connection drops. Only ever retries
 * once, and only for errors that look like a stale-socket problem — a real constraint violation
 * or business error is never retried.
 */
const extendedPrismaClient = basePrismaClient.$extends({
  name: 'retry-on-stale-connection',
  query: {
    async $allOperations({ operation, model, args, query }) {
      try {
        return await query(args);
      } catch (error) {
        if (!isRetryableConnectionError(error)) throw error;
        logger.warn('prisma_retrying_after_stale_connection', { model, operation });
        return await query(args);
      }
    },
  },
});

const globalForPrisma = globalThis as unknown as { prisma?: typeof extendedPrismaClient };

export const prisma = globalForPrisma.prisma ?? extendedPrismaClient;

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
