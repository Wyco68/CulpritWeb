'use client';

import { useState } from 'react';
import { GraduationCap, Plus } from 'lucide-react';
import { useDeleteRecord } from '@/modules/shared/lib/use-delete-record';
import { Button } from '@/modules/shared/ui/button';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { ConfirmDialog } from '@/modules/shared/ui/confirm-dialog';
import { RowActions } from '@/modules/shared/ui/row-actions';
import { FormSection, FormSectionCount } from '@/modules/shared/ui/form-section';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/modules/shared/ui/table';
// Deep imports, not the barrel — see course-form-dialog.tsx's comment.
import { CV_SECTION_LABELS, type CvEntry, type CvSection } from '../teaching.types';
import { CvEntryFormDialog } from './cv-entry-form-dialog';

// One CV list per admin section, on whichever admin screen mirrors the public tab that renders it:
// education/fellowship/scholarship/invited_talk on About, research_interest on Research,
// teaching_role/teaching_award on Teaching.
//
// Previously all seven lists sat in a single table on /admin/teaching with a "List" column, which
// meant editing the About tab's education list happened on a screen called Teaching. The section
// is now the heading rather than a column value, so where an entry lives is the same question as
// where you are standing.
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
  education: 'Degrees and qualifications, shown on the public About tab.',
  fellowship: 'Fellowships and visiting appointments, shown on the public About tab.',
  scholarship: 'Scholarships and travel awards, shown on the public About tab.',
  research_interest: 'The topics listed under the research statement on the public Research tab.',
  invited_talk: 'Keynotes and invited talks, shown on the public About tab.',
  teaching_role: 'Lecturing and supervision roles, shown on the public Teaching tab.',
  teaching_award: 'Teaching prizes and commendations, shown on the public Teaching tab.',
};

export interface CvEntriesAdminProps {
  /** The lists this screen owns, in the order the matching public tab renders them. */
  sections: readonly CvSection[];
  /** Every entry for those sections. Filtering happens here so the page stays a single query. */
  entries: CvEntry[];
}

export function CvEntriesAdmin({ sections, entries }: CvEntriesAdminProps) {
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
      {sections.map((section) => {
        const rows = entries.filter((entry) => entry.section === section);
        const itemLabel = CV_SECTION_ITEM_LABELS[section];

        return (
          <div key={section} id={`cv-${section}`} className="scroll-mt-24">
            <FormSection
              title={CV_SECTION_LABELS[section]}
              description={CV_SECTION_DESCRIPTIONS[section]}
              badge={<FormSectionCount count={rows.length} />}
              action={
                // Several sections sit on one screen, so a bare "Add" would give every button the
                // same accessible name. The visible word stays inside the name (WCAG 2.5.3).
                <Button aria-label={`Add ${itemLabel}`} onClick={() => openCreate(section)}>
                  <Plus className="size-4" aria-hidden="true" />
                  Add
                </Button>
              }
            >
              {rows.length === 0 ? (
                <EmptyState
                  icon={GraduationCap}
                  title={`No ${CV_SECTION_LABELS[section].toLowerCase()} yet.`}
                  description={`Add the first ${itemLabel} to show this list on the public site.`}
                />
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Entry</TableHead>
                      <TableHead>Year</TableHead>
                      <TableHead>Order</TableHead>
                      <TableHead className="text-right">Actions</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {rows.map((entry) => (
                      <TableRow key={entry.id}>
                        <TableCell className="min-w-0 font-medium text-foreground">
                          {/* User-entered text: bounded and wrapped, or one long unbroken title
                              stretches the table past its container. */}
                          <span className="line-clamp-2 block max-w-[46ch] break-words">
                            {entry.title}
                          </span>
                          {entry.subtitle && (
                            <span className="mt-0.5 line-clamp-2 block max-w-[46ch] break-words text-xs font-normal text-muted-foreground">
                              {entry.subtitle}
                            </span>
                          )}
                        </TableCell>
                        <TableCell className="tabular whitespace-nowrap text-muted-foreground">
                          {entry.year ?? '—'}
                        </TableCell>
                        <TableCell className="tabular text-muted-foreground">
                          {entry.sortOrder}
                        </TableCell>
                        <TableCell className="text-right">
                          <RowActions
                            editLabel={`Edit entry: ${entry.title}`}
                            deleteLabel={`Delete entry: ${entry.title}`}
                            onEdit={() => openEdit(entry)}
                            onDelete={() => remove.request(entry)}
                          />
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </FormSection>
          </div>
        );
      })}

      <CvEntryFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        entry={editing}
        defaultSection={defaultSection}
      />

      <ConfirmDialog
        {...remove.dialogProps}
        title="Delete this entry?"
        description="It is removed from the public site. This action cannot be undone."
      />
    </>
  );
}
