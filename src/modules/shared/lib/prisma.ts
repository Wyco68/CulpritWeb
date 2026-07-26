import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

// Prisma is imported ONLY here and in repositories. Singleton to survive HMR / serverless reuse.
// Prisma 7 requires a driver adapter; Neon's serverless driver works over HTTP/WebSocket,
// which is what makes this viable on Vercel's serverless/edge runtimes.
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

const adapter = new PrismaNeon({ connectionString: process.env.DATABASE_URL });

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;
