'use client';

import { useState } from 'react';
import { BookOpen, EyeOff, Pencil, Plus, Trash2 } from 'lucide-react';
import { useDeleteRecord } from '@/modules/shared/lib/use-delete-record';
import { Button } from '@/modules/shared/ui/button';
import { ConfirmDialog } from '@/modules/shared/ui/confirm-dialog';
import { FormSection, FormSectionCount } from '@/modules/shared/ui/form-section';
import { RecordIdentity, RecordTable } from '@/modules/shared/ui/record-table';
import type { RowAction } from '@/modules/shared/ui/row-actions-menu';
// Deep imports, not the barrel — see course-form-dialog.tsx's comment.
import type { Course } from '../teaching.types';
import { CourseFormDialog } from './course-form-dialog';

// The courses section of a member's admin profile page, next to that member's CV lists.
//
// Only some teams teach (ADR-017). For a team that does not, the section is not offered at all —
// the server answers 400 on a create, and an admin should never be able to click into a form whose
// only outcome is a rejection. What it does NOT do is hide rows that already exist: a team change
// never deletes anything, so courses written while the member taught stay visible here, read-only
// apart from Delete, with the reason said in text.

/** Said where the rows are, not in a banner at the top: the explanation belongs next to the data. */
const RETIRED_DESCRIPTION =
  'This team does not teach, so these no longer appear on the public profile. They are kept on record — delete them, or move the member back to a team that teaches.';

export function CoursesAdmin({
  teamMemberId,
  courses,
  allowed = true,
}: {
  /** The member who teaches these courses. */
  teamMemberId: string;
  courses: Course[];
  /** Whether this member's team may have courses at all — `allowsCourses(member.teamKind)`. */
  allowed?: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Course | undefined>(undefined);

  const remove = useDeleteRecord<Course>((id) => `/api/admin/teaching/courses/${id}`);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  // Nothing to show and nothing to add: the section would be an empty box explaining an absence.
  if (!allowed && courses.length === 0) return null;

  return (
    <div id="courses" className="scroll-mt-24">
      <FormSection
        title="Courses"
        description={
          allowed ? "Shown on the member's public profile, grouped by level." : RETIRED_DESCRIPTION
        }
        badge={<FormSectionCount count={courses.length} />}
        action={
          allowed ? (
            <Button aria-label="Add course" onClick={openCreate}>
              <Plus className="size-4" aria-hidden="true" />
              Add
            </Button>
          ) : undefined
        }
      >
        <RecordTable
          items={courses}
          noun="courses"
          searchText={(course) =>
            [course.code, course.title, course.level, course.term].filter(Boolean).join(' ')
          }
          identityHeader="Course"
          identity={(course) => (
            <RecordIdentity
              title={
                <>
                  {course.code && (
                    <span className="mr-2 font-mono text-xs text-muted-foreground">
                      {course.code}
                    </span>
                  )}
                  {course.title}
                </>
              }
              detail={course.term ?? undefined}
            />
          )}
          statusHeader="Profile"
          // Retired rows are the ones a team change left behind (ADR-017): kept, but not shown.
          status={() =>
            allowed
              ? { tone: 'ok', label: 'On profile' }
              : { tone: 'neutral', label: 'Hidden', icon: EyeOff }
          }
          groupHeader="Level"
          group={(course) => (
            <span className="block max-w-[20ch] truncate" title={course.level}>
              {course.level}
            </span>
          )}
          rowLabel={(course) => `Actions: ${course.title}`}
          actions={(course) => {
            const del: RowAction = {
              label: 'Delete',
              ariaLabel: `Delete course: ${course.title}`,
              icon: Trash2,
              destructive: true,
              onSelect: () => remove.request(course),
            };
            if (!allowed) return [del];
            return [
              {
                label: 'Edit',
                ariaLabel: `Edit course: ${course.title}`,
                icon: Pencil,
                onSelect: () => {
                  setEditing(course);
                  setFormOpen(true);
                },
              },
              del,
            ];
          }}
          empty={{
            icon: BookOpen,
            title: 'No courses yet.',
            description: "Courses appear on the member's public profile, grouped by level.",
            action: { label: 'Add your first course', onClick: openCreate },
          }}
        />
      </FormSection>

      {allowed && (
        <CourseFormDialog
          teamMemberId={teamMemberId}
          open={formOpen}
          onOpenChange={setFormOpen}
          course={editing}
        />
      )}

      <ConfirmDialog
        {...remove.dialogProps}
        title="Delete this course?"
        description="It is removed from the public profile. This action cannot be undone."
        confirmationText="delete"
      />
    </div>
  );
}
