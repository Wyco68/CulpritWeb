import { prisma } from '@/modules/shared/lib/prisma';
import type { Prisma, Profile as PrismaProfile } from '@prisma/client';
import type { AuditContext, Profile, ProfileListItem } from './profile.types';
import type { UpdateProfileInput } from './profile.schema';

// The ONLY place Prisma is used for profile data. Singleton: exactly one row is ever read/written.
// Seed/upsert-on-first-read — a fresh DB has no row until the admin's first save, so `get()`
// lazily creates a blank placeholder row rather than 404ing the public bio page.

export type UpdateProfileData = UpdateProfileInput;

export interface ProfileRepository {
  /** Returns the singleton row, creating a blank placeholder on first read. */
  get(): Promise<Profile>;
  /** Upsert the singleton row and write an audit entry in one transaction. */
  updateWithAudit(input: { data: UpdateProfileData; audit: AuditContext }): Promise<Profile>;
}

function toListItems(value: Prisma.JsonValue | null): ProfileListItem[] | null {
  if (value === null || value === undefined) return null;
  return value as unknown as ProfileListItem[];
}

function toDomain(row: PrismaProfile): Profile {
  return {
    id: row.id,
    fullName: row.fullName,
    title: row.title,
    photoUrl: row.photoUrl,
    bio: row.bio,
    positionAffiliation: row.positionAffiliation,
    education: toListItems(row.education),
    fellowshipsVisiting: toListItems(row.fellowshipsVisiting),
    teachingRoles: toListItems(row.teachingRoles),
    teachingAwards: toListItems(row.teachingAwards),
    scholarshipsTravelAwards: toListItems(row.scholarshipsTravelAwards),
    researchInterests: toListItems(row.researchInterests),
    researchStatement: row.researchStatement,
    invitedTalks: toListItems(row.invitedTalks),
    linkedinUrl: row.linkedinUrl,
    googleScholarUrl: row.googleScholarUrl,
    updatedAt: row.updatedAt,
  };
}

function auditCreateInput(audit: AuditContext, entityId: string): Prisma.AuditLogCreateInput {
  return {
    actor: audit.actor,
    action: audit.action,
    entityType: 'profile',
    entityId,
    metadata: (audit.metadata ?? undefined) as Prisma.InputJsonValue | undefined,
  };
}

/** Blank placeholder used only when the singleton row does not exist yet. */
const BLANK_PROFILE_DATA: Prisma.ProfileCreateInput = {
  fullName: '',
  title: '',
};

export class PrismaProfileRepository implements ProfileRepository {
  async get(): Promise<Profile> {
    const existing = await prisma.profile.findFirst();
    if (existing) return toDomain(existing);
    const created = await prisma.profile.create({ data: BLANK_PROFILE_DATA });
    return toDomain(created);
  }

  async updateWithAudit(input: {
    data: UpdateProfileData;
    audit: AuditContext;
  }): Promise<Profile> {
    const updated = await prisma.$transaction(async (tx) => {
      const existing = await tx.profile.findFirst();
      // Plain scalar fields — assignable to BOTH ProfileUpdateInput and ProfileCreateInput (the
      // update-operations union, e.g. StringFieldUpdateOperationsInput, is only needed for atomic
      // ops like `{ increment: 1 }`, which this module never uses).
      const fields = {
        fullName: input.data.fullName,
        title: input.data.title,
        photoUrl: input.data.photoUrl ?? null,
        bio: input.data.bio ?? null,
        positionAffiliation: input.data.positionAffiliation ?? null,
        education: (input.data.education ?? undefined) as Prisma.InputJsonValue | undefined,
        fellowshipsVisiting: (input.data.fellowshipsVisiting ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        teachingRoles: (input.data.teachingRoles ?? undefined) as Prisma.InputJsonValue | undefined,
        teachingAwards: (input.data.teachingAwards ?? undefined) as Prisma.InputJsonValue | undefined,
        scholarshipsTravelAwards: (input.data.scholarshipsTravelAwards ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        researchInterests: (input.data.researchInterests ?? undefined) as
          | Prisma.InputJsonValue
          | undefined,
        researchStatement: input.data.researchStatement ?? null,
        invitedTalks: (input.data.invitedTalks ?? undefined) as Prisma.InputJsonValue | undefined,
        linkedinUrl: input.data.linkedinUrl ?? null,
        googleScholarUrl: input.data.googleScholarUrl ?? null,
      };

      const row = existing
        ? await tx.profile.update({ where: { id: existing.id }, data: fields })
        : await tx.profile.create({ data: { ...BLANK_PROFILE_DATA, ...fields } });

      await tx.auditLog.create({ data: auditCreateInput(input.audit, row.id) });
      return row;
    });
    return toDomain(updated);
  }
}
