'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { BookOpen, GraduationCap, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/modules/shared/ui/button';
import { PageHeading } from '@/modules/shared/ui/page-heading';
import { EmptyState } from '@/modules/shared/ui/empty-state';
import { ConfirmDialog } from '@/modules/shared/ui/confirm-dialog';
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
import { CV_SECTION_LABELS, type Course, type CvEntry, type CvSection } from '../teaching.types';
import { CourseFormDialog } from './course-form-dialog';
import { CvEntryFormDialog } from './cv-entry-form-dialog';

// Admin: one screen for everything that feeds the Teaching tab and the About tab's CV lists.
//
// Courses and CV entries share a screen rather than getting one each because the admin thinks of
// them together ("what I teach"), and because the seven CV lists are far too small to justify
// seven navigation destinations. The section column keeps them distinguishable.

async function deleteCourse(id: string) {
  const response = await fetch(`/api/admin/teaching/courses/${id}`, { method: 'DELETE' });
  const body = await response.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'Request failed');
}

async function deleteEntry(id: string) {
  const response = await fetch(`/api/admin/teaching/entries/${id}`, { method: 'DELETE' });
  const body = await response.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'Request failed');
}

type Pending =
  | { kind: 'course'; item: Course }
  | { kind: 'entry'; item: CvEntry };

export function TeachingAdmin({ courses, entries }: { courses: Course[]; entries: CvEntry[] }) {
  const router = useRouter();

  const [courseFormOpen, setCourseFormOpen] = useState(false);
  const [editingCourse, setEditingCourse] = useState<Course | undefined>(undefined);

  const [entryFormOpen, setEntryFormOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<CvEntry | undefined>(undefined);
  const [entrySection, setEntrySection] = useState<CvSection | undefined>(undefined);

  const [deleting, setDeleting] = useState<Pending | undefined>(undefined);

  const deleteMutation = useMutation({
    mutationFn: (pending: Pending) =>
      pending.kind === 'course' ? deleteCourse(pending.item.id) : deleteEntry(pending.item.id),
    onSuccess: () => {
      toast.success('Deleted.');
      setDeleting(undefined);
      router.refresh();
    },
    onError: () => toast.error('Could not delete. Please try again.'),
  });

  return (
    <div className="flex flex-col gap-12 pb-8">
      <PageHeading
        as="h1"
        title="Teaching"
        intro="Courses and the CV lists behind the public About and Teaching tabs."
      />

      <FormSection
        title="Courses"
        description="Shown on the public Teaching tab, grouped by level."
        badge={<FormSectionCount count={courses.length} />}
        action={
          <Button
            onClick={() => {
              setEditingCourse(undefined);
              setCourseFormOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add course
          </Button>
        }
      >
        {courses.length === 0 ? (
          <EmptyState
            icon={BookOpen}
            title="No courses yet."
            description="Add the first course to show it on the public Teaching tab."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Course</TableHead>
                <TableHead>Level</TableHead>
                <TableHead>Term</TableHead>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {courses.map((course) => (
                <TableRow key={course.id}>
                  <TableCell className="font-medium text-foreground">
                    {course.code && (
                      <span className="mr-2 font-mono text-xs text-muted-foreground">
                        {course.code}
                      </span>
                    )}
                    {course.title}
                  </TableCell>
                  <TableCell className="text-muted-foreground">{course.level}</TableCell>
                  <TableCell className="text-muted-foreground">{course.term ?? '—'}</TableCell>
                  <TableCell className="tabular text-muted-foreground">
                    {course.sortOrder}
                  </TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit course: ${course.title}`}
                        onClick={() => {
                          setEditingCourse(course);
                          setCourseFormOpen(true);
                        }}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete course: ${course.title}`}
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleting({ kind: 'course', item: course })}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </FormSection>

      <FormSection
        title="CV entries"
        description="Education, fellowships, scholarships, research interests and invited talks appear on About. Teaching roles and awards appear on Teaching."
        badge={<FormSectionCount count={entries.length} />}
        action={
          <Button
            onClick={() => {
              setEditingEntry(undefined);
              setEntrySection(undefined);
              setEntryFormOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add entry
          </Button>
        }
      >
        {entries.length === 0 ? (
          <EmptyState
            icon={GraduationCap}
            title="No entries yet."
            description="Add education, fellowships, teaching roles and the rest here."
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Entry</TableHead>
                <TableHead>List</TableHead>
                <TableHead>Year</TableHead>
                <TableHead>Order</TableHead>
                <TableHead className="text-right">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => (
                <TableRow key={entry.id}>
                  <TableCell className="font-medium text-foreground">
                    {entry.title}
                    {entry.subtitle && (
                      <span className="mt-0.5 block text-xs font-normal text-muted-foreground">
                        {entry.subtitle}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-muted-foreground">
                    {CV_SECTION_LABELS[entry.section]}
                  </TableCell>
                  <TableCell className="tabular text-muted-foreground">
                    {entry.year ?? '—'}
                  </TableCell>
                  <TableCell className="tabular text-muted-foreground">{entry.sortOrder}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex justify-end gap-1.5">
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Edit entry: ${entry.title}`}
                        onClick={() => {
                          setEditingEntry(entry);
                          setEntrySection(undefined);
                          setEntryFormOpen(true);
                        }}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete entry: ${entry.title}`}
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleting({ kind: 'entry', item: entry })}
                      >
                        <Trash2 className="size-4" aria-hidden="true" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </FormSection>

      <CourseFormDialog
        open={courseFormOpen}
        onOpenChange={setCourseFormOpen}
        course={editingCourse}
      />
      <CvEntryFormDialog
        open={entryFormOpen}
        onOpenChange={setEntryFormOpen}
        entry={editingEntry}
        defaultSection={entrySection}
      />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title={deleting?.kind === 'course' ? 'Delete this course?' : 'Delete this entry?'}
        description="It is removed from the public site. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting)}
      />
    </div>
  );
}
