'use client';

import { useState } from 'react';
import { EyeOff, GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react';
import { useDeleteRecord } from '@/modules/shared/lib/use-delete-record';
import { Button } from '@/modules/shared/ui/button';
import { ConfirmDialog } from '@/modules/shared/ui/confirm-dialog';
import { FormSection, FormSectionCount } from '@/modules/shared/ui/form-section';
import { RecordIdentity, RecordTable } from '@/modules/shared/ui/record-table';
import type { RowAction } from '@/modules/shared/ui/row-actions-menu';
// Deep imports, not the barrel — see course-form-dialog.tsx's comment.
import { CV_SECTION_LABELS, type CvEntry, type CvSection } from '../teaching.types';
import { CvEntryFormDialog } from './cv-entry-form-dialog';

// One CV list per section of a member's profile, all on that member's admin page.
//
// The dialog and the delete confirmation are mounted once for the whole screen rather than once
// per section: they are singletons driven by which row was clicked, and N copies of a focus-
// trapping dialog is N times the DOM for no behavioural difference.

/**
 * The singular noun for one row of each list, used in the "Add" button's accessible name and in
 * the empty state. `CV_SECTION_LABELS` are plural list headings and read wrong there
 * ("Add Scholarships & travel awards").
 */
const CV_SECTION_ITEM_LABELS: Record<CvSection, string> = {
  education: 'education entry',
  fellowship: 'fellowship',
  scholarship: 'scholarship',
  research_interest: 'research interest',
  invited_talk: 'invited talk',
  teaching_role: 'teaching role',
  teaching_award: 'teaching award',
};

/** What each list is for, said once where the admin is about to add to it. */
const CV_SECTION_DESCRIPTIONS: Record<CvSection, string> = {
  education: 'Degrees and qualifications.',
  fellowship: 'Fellowships and visiting appointments.',
  scholarship: 'Scholarships and travel awards.',
  research_interest: 'The topics this member works on.',
  invited_talk: 'Keynotes and invited talks.',
  teaching_role: 'Lecturing and supervision roles.',
  teaching_award: 'Teaching prizes and commendations.',
};

/**
 * Shown instead of a section's own description once the member's team no longer uses it. Said
 * where the rows are rather than in a banner at the top of the screen.
 */
const RETIRED_DESCRIPTION =
  'This team does not use this list, so these no longer appear on the public profile. They are kept on record — delete them, or move the member to a team that uses them.';

export interface CvEntriesAdminProps {
  /** The member whose profile these lists belong to. */
  teamMemberId: string;
  /** The lists to edit, in the order the public profile renders them. */
  sections: readonly CvSection[];
  /**
   * Lists this member's team may NOT have but which still hold rows (ADR-017: a team change never
   * deletes anything). Rendered after the editable ones, delete-only. Usually empty.
   */
  retiredSections?: readonly CvSection[];
  /** Every entry for those sections. Filtering happens here so the page stays a single query. */
  entries: CvEntry[];
}

export function CvEntriesAdmin({
  teamMemberId,
  sections,
  retiredSections = [],
  entries,
}: CvEntriesAdminProps) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<CvEntry | undefined>(undefined);
  const [defaultSection, setDefaultSection] = useState<CvSection | undefined>(undefined);

  const remove = useDeleteRecord<CvEntry>((id) => `/api/admin/teaching/entries/${id}`);

  function openCreate(section: CvSection) {
    setEditing(undefined);
    setDefaultSection(section);
    setFormOpen(true);
  }

  function openEdit(entry: CvEntry) {
    setEditing(entry);
    setDefaultSection(undefined);
    setFormOpen(true);
  }

  return (
    <>
      {[...sections, ...retiredSections].map((section) => {
        const rows = entries.filter((entry) => entry.section === section);
        const itemLabel = CV_SECTION_ITEM_LABELS[section];
        const retired = retiredSections.includes(section);
        // A retired list with nothing in it is an empty box explaining an absence. Callers pass
        // only the sections that still hold rows, and this keeps that true if one ever doesn't.
        if (retired && rows.length === 0) return null;

        return (
          <div key={section} id={`cv-${section}`} className="scroll-mt-24">
            <FormSection
              title={CV_SECTION_LABELS[section]}
              description={retired ? RETIRED_DESCRIPTION : CV_SECTION_DESCRIPTIONS[section]}
              badge={<FormSectionCount count={rows.length} />}
              action={
                // Several sections sit on one screen, so a bare "Add" would give every button the
                // same accessible name. The visible word stays inside the name (WCAG 2.5.3).
                retired ? undefined : (
                  <Button aria-label={`Add ${itemLabel}`} onClick={() => openCreate(section)}>
                    <Plus className="size-4" aria-hidden="true" />
                    Add
                  </Button>
                )
              }
            >
              <RecordTable
                items={rows}
                noun={CV_SECTION_LABELS[section].toLowerCase()}
                searchText={(entry) =>
                  [entry.title, entry.subtitle, entry.year].filter(Boolean).join(' ')
                }
                identityHeader="Entry"
                identity={(entry) => (
                  <RecordIdentity title={entry.title} detail={entry.subtitle ?? undefined} />
                )}
                statusHeader="Profile"
                status={() =>
                  retired
                    ? { tone: 'neutral', label: 'Hidden', icon: EyeOff }
                    : { tone: 'ok', label: 'On profile' }
                }
                groupHeader="Year"
                group={(entry) => (
                  <span className="tabular whitespace-nowrap">{entry.year ?? '—'}</span>
                )}
                rowLabel={(entry) => `Actions: ${entry.title}`}
                actions={(entry) => {
                  const del: RowAction = {
                    label: 'Delete',
                    ariaLabel: `Delete entry: ${entry.title}`,
                    icon: Trash2,
                    destructive: true,
                    onSelect: () => remove.request(entry),
                  };
                  if (retired) return [del];
                  return [
                    {
                      label: 'Edit',
                      ariaLabel: `Edit entry: ${entry.title}`,
                      icon: Pencil,
                      onSelect: () => openEdit(entry),
                    },
                    del,
                  ];
                }}
                empty={{
                  icon: GraduationCap,
                  title: `No ${CV_SECTION_LABELS[section].toLowerCase()} yet.`,
                  description: "Entries appear in this list on the member's public profile.",
                  action: {
                    label: `Add your first ${itemLabel}`,
                    onClick: () => openCreate(section),
                  },
                }}
              />
            </FormSection>
          </div>
        );
      })}

      <CvEntryFormDialog
        teamMemberId={teamMemberId}
        open={formOpen}
        onOpenChange={setFormOpen}
        entry={editing}
        defaultSection={defaultSection}
      />

      <ConfirmDialog
        {...remove.dialogProps}
        title="Delete this entry?"
        description="It is removed from the public site. This action cannot be undone."
        confirmationText="delete"
      />
    </>
  );
}
