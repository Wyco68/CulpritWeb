// Type-only import: erased at build, so this stays consistent with 'Prisma is imported only in
// repositories' — the runtime client is never pulled in here.
import type { Prisma } from '@prisma/client';

/** Append-only audit context supplied by the service, persisted by the repository. */
export type AuditContext = {
  actor: string;
  action: string;
  metadata?: Record<string, unknown>;
};

/**
 * Builds the `AuditLog` row every mutating repository writes inside its own transaction.
 * `entityType` is fixed per repository; the rest comes from the service's audit context.
 */
export function auditLogData(
  entityType: string,
  audit: AuditContext,
  entityId: string,
): Prisma.AuditLogCreateInput {
  return {
    actor: audit.actor,
    action: audit.action,
    entityType,
    entityId,
    metadata: (audit.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
  };
}
