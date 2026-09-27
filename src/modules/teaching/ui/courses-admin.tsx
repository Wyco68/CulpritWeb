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

// The courses section of a member's admin profile page, next to that member's CV lists. Always
// editable; while the member's Courses section is switched off (ADR-020) the rows are marked as
// hidden from the public profile, with the reason said next to them.

const HIDDEN_NOTE = 'Hidden from the public profile — switch it on under “Shown on profile”.';

export function CoursesAdmin({
  teamMemberId,
  courses,
  hidden = false,
}: {
  /** The member who teaches these courses. */
  teamMemberId: string;
  courses: Course[];
  /** Whether the member's Courses section is switched off on their public profile. */
  hidden?: boolean;
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Course | undefined>(undefined);

  const remove = useDeleteRecord<Course>((id) => `/api/admin/teaching/courses/${id}`);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  return (
    <div id="courses" className="scroll-mt-24">
      <FormSection
        title="Courses"
        description={`Shown on the member's public profile, grouped by level.${hidden ? ` ${HIDDEN_NOTE}` : ''}`}
        badge={<FormSectionCount count={courses.length} />}
        action={
          <Button aria-label="Add course" onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" />
            Add
          </Button>
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
                    <span className="tabular mr-2 text-xs font-medium text-muted-foreground">
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
          status={() =>
            hidden
              ? { tone: 'neutral', label: 'Hidden', icon: EyeOff }
              : { tone: 'ok', label: 'On profile' }
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

      <CourseFormDialog
        teamMemberId={teamMemberId}
        open={formOpen}
        onOpenChange={setFormOpen}
        course={editing}
      />

      <ConfirmDialog
        {...remove.dialogProps}
        title="Delete this course?"
        description="It is removed from the public profile. This action cannot be undone."
        confirmationText="delete"
      />
    </div>
  );
}
