import { PrismaClient } from '@prisma/client';
import { PrismaPg } from '@prisma/adapter-pg';
import { logger } from './logger';

// Prisma is imported ONLY here and in repositories. Singleton to survive HMR / serverless reuse.
// Prisma 7 requires a driver adapter; `@prisma/adapter-pg` wraps a standard `pg` Pool, which is
// what Supabase Postgres (or any plain Postgres host) expects — DATABASE_URL should point at
// Supabase's pooled connection (port 6543, pgbouncer) so serverless/edge invocations on Vercel
// don't exhaust the DB's direct connection limit.
//
// A pooled connection can still hand back a socket that died while idle between invocations —
// the *next* query grabbed from the pool then fails immediately, before any SQL reaches the wire,
// surfacing as an opaque 500. The pool can't transparently recover from this (a dead socket errors
// once and is evicted), so we retry the query once below: the retry gets a freshly-dialed
// connection and succeeds.
const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });

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
  const message =
    error instanceof Error ? `${error.message} ${String(error.cause ?? '')}` : String(error);
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
