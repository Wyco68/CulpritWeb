import { prisma } from '@/modules/shared/lib/prisma';
import type { Prisma } from '@prisma/client';
import type { AuditContext } from './setting.types';

// The ONLY place Prisma is used for setting data. Generic key/value store — the service owns the
// typed shape (Settings) and defaults; the repository just persists raw JSON values atomically
// alongside a single audit entry per PUT.

export interface SettingRepository {
  /** Raw values for the given keys, keyed by DB key. Missing keys are simply absent. */
  getMany(keys: string[]): Promise<Record<string, unknown>>;
  /** Upsert every key/value pair and write one audit entry in a single transaction. */
  setManyWithAudit(input: {
    values: Record<string, unknown>;
    audit: AuditContext;
  }): Promise<void>;
}

export class PrismaSettingRepository implements SettingRepository {
  async getMany(keys: string[]): Promise<Record<string, unknown>> {
    const rows = await prisma.setting.findMany({ where: { key: { in: keys } } });
    return Object.fromEntries(rows.map((row) => [row.key, row.value]));
  }

  async setManyWithAudit(input: {
    values: Record<string, unknown>;
    audit: AuditContext;
  }): Promise<void> {
    const entries = Object.entries(input.values);
    await prisma.$transaction(async (tx) => {
      for (const [key, value] of entries) {
        await tx.setting.upsert({
          where: { key },
          create: { key, value: value as Prisma.InputJsonValue },
          update: { value: value as Prisma.InputJsonValue },
        });
      }
      const audit: Prisma.AuditLogCreateInput = {
        actor: input.audit.actor,
        action: input.audit.action,
        entityType: 'setting',
        entityId: entries.map(([key]) => key).join(','),
        metadata: {
          ...(input.audit.metadata ?? {}),
          values: input.values as Prisma.InputJsonValue,
        } as Prisma.InputJsonValue,
      };
      await tx.auditLog.create({ data: audit });
    });
  }
}
