'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { apiSend } from '@/modules/shared/lib/api-client';
import {
  PROFILE_SECTIONS,
  PROFILE_SECTION_LABELS,
  type ProfileSection,
} from '@/modules/shared/lib/profile-sections';
import { FormSection } from '@/modules/shared/ui/form-section';
import { Switch } from '@/modules/shared/ui/switch';

// Which sections this member's public profile shows (ADR-020). Replaced the fixed per-team rules:
// the admin decides member by member. Each switch saves on its own — there is nothing else on this
// panel to wait for — and a hidden section keeps its entries for when it is switched back on.

/** Where each section's content comes from, so the admin knows what switching it on will show. */
const SOURCE: Partial<Record<ProfileSection, string>> = {
  publications: 'Publications that credit this member by name.',
  research: 'Research works that credit this member by name.',
};

export function SectionVisibility({
  member,
}: {
  member: { id: string; name: string; hiddenSections: ProfileSection[] };
}) {
  const router = useRouter();
  const [hidden, setHidden] = useState<ProfileSection[]>(member.hiddenSections);
  const [saving, setSaving] = useState<ProfileSection | null>(null);

  async function toggle(section: ProfileSection, show: boolean) {
    const previous = hidden;
    const next = show ? hidden.filter((s) => s !== section) : [...hidden, section];
    setHidden(next); // optimistic: the switch moves at once, and moves back if the save fails
    setSaving(section);
    try {
      await apiSend('PUT', `/api/admin/team-members/${member.id}`, { hiddenSections: next });
      toast.success(
        `${PROFILE_SECTION_LABELS[section]} ${show ? 'shown on' : 'hidden from'} ${member.name}'s profile.`,
      );
      router.refresh();
    } catch {
      setHidden(previous);
      toast.error('Could not save. Please try again.');
    } finally {
      setSaving(null);
    }
  }

  return (
    <div id="visibility" className="scroll-mt-24">
      <FormSection
        title="Shown on profile"
        description="Switch off a section to hide it from this member's public page. Hidden sections keep their entries and can still be edited below. A section with nothing in it never shows."
      >
        <div className="grid gap-x-6 sm:grid-cols-2">
          {PROFILE_SECTIONS.map((section) => (
            <Switch
              key={section}
              label={PROFILE_SECTION_LABELS[section]}
              description={SOURCE[section]}
              checked={!hidden.includes(section)}
              disabled={saving !== null}
              onCheckedChange={(show) => void toggle(section, show)}
              className="-mx-3"
            />
          ))}
        </div>
      </FormSection>
    </div>
  );
}
