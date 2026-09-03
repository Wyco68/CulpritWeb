'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { BookOpen, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { useRouter } from 'next/navigation';
import { Button } from '@/modules/shared/ui/button';
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
import type { Course } from '../teaching.types';
import { CourseFormDialog } from './course-form-dialog';

// The courses section of the admin Teaching screen. A section rather than a whole screen: the
// screen it sits on mirrors one public tab, and that tab also carries the teaching intro and the
// two teaching CV lists.

async function deleteCourse(id: string) {
  const response = await fetch(`/api/admin/teaching/courses/${id}`, { method: 'DELETE' });
  const body = await response.json();
  if (!body.ok) throw new Error(body.error?.message ?? 'Request failed');
}

export function CoursesAdmin({ courses }: { courses: Course[] }) {
  const router = useRouter();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Course | undefined>(undefined);
  const [deleting, setDeleting] = useState<Course | undefined>(undefined);

  const deleteMutation = useMutation({
    mutationFn: deleteCourse,
    onSuccess: () => {
      toast.success('Deleted.');
      setDeleting(undefined);
      router.refresh();
    },
    onError: () => toast.error('Could not delete. Please try again.'),
  });

  return (
    <div id="courses" className="scroll-mt-24">
      <FormSection
        title="Courses"
        description="Shown on the public Teaching tab, grouped by level."
        badge={<FormSectionCount count={courses.length} />}
        action={
          <Button
            aria-label="Add course"
            onClick={() => {
              setEditing(undefined);
              setFormOpen(true);
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            Add
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
                  <TableCell className="min-w-0 font-medium text-foreground">
                    <span className="line-clamp-2 block max-w-[46ch] break-words">
                      {course.code && (
                        <span className="mr-2 font-mono text-xs text-muted-foreground">
                          {course.code}
                        </span>
                      )}
                      {course.title}
                    </span>
                  </TableCell>
                  <TableCell className="min-w-0 text-muted-foreground">
                    <span className="block max-w-[20ch] truncate" title={course.level}>
                      {course.level}
                    </span>
                  </TableCell>
                  <TableCell className="min-w-0 text-muted-foreground">
                    <span className="block max-w-[18ch] truncate" title={course.term ?? undefined}>
                      {course.term ?? '—'}
                    </span>
                  </TableCell>
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
                          setEditing(course);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="size-4" aria-hidden="true" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        aria-label={`Delete course: ${course.title}`}
                        className="text-destructive hover:bg-destructive/10"
                        onClick={() => setDeleting(course)}
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

      <CourseFormDialog open={formOpen} onOpenChange={setFormOpen} course={editing} />

      <ConfirmDialog
        open={Boolean(deleting)}
        onOpenChange={(open) => !open && setDeleting(undefined)}
        title="Delete this course?"
        description="It is removed from the public Teaching tab. This action cannot be undone."
        confirmLabel="Delete"
        cancelLabel="Cancel"
        loading={deleteMutation.isPending}
        onConfirm={() => deleting && deleteMutation.mutate(deleting.id)}
      />
    </div>
  );
}
