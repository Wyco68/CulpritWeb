'use client';

import { useState } from 'react';
import { Hammer, Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useDeleteRecord } from '@/modules/shared/lib/use-delete-record';
import { Button } from '@/modules/shared/ui/button';
import { ConfirmDialog } from '@/modules/shared/ui/confirm-dialog';
import { FormSection, FormSectionCount } from '@/modules/shared/ui/form-section';
import { RecordIdentity, RecordTable } from '@/modules/shared/ui/record-table';
// Deep imports, not the barrel — see project-form-dialog.tsx's comment.
import type { Project } from '../project.types';
import { ProjectFormDialog } from './project-form-dialog';

// The projects section of a member's admin page, alongside their CV lists and courses. Every team
// may have projects (ADR-017), so there is no per-team gate here.

export function ProjectsAdmin({
  teamMemberId,
  projects,
}: {
  /** The member whose profile these projects belong to. */
  teamMemberId: string;
  projects: Project[];
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Project | undefined>(undefined);

  const remove = useDeleteRecord<Project>((id) => `/api/admin/projects/${id}`);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  return (
    <div id="projects" className="scroll-mt-24">
      <FormSection
        title="Projects"
        description="Shown on the member's public profile, in sort order."
        badge={<FormSectionCount count={projects.length} />}
        action={
          <Button aria-label="Add project" onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" />
            Add
          </Button>
        }
      >
        <RecordTable
          items={projects}
          noun="projects"
          searchText={(project) => [project.title, project.summary].join(' ')}
          identityHeader="Project"
          identity={(project) => <RecordIdentity title={project.title} detail={project.summary} />}
          statusHeader="Link"
          status={(project) =>
            project.link
              ? { tone: 'ok', label: 'Linked', icon: Link2 }
              : { tone: 'neutral', label: 'No link' }
          }
          groupHeader="Order"
          group={(project) => <span className="tabular">{project.sortOrder}</span>}
          rowLabel={(project) => `Actions: ${project.title}`}
          actions={(project) => [
            {
              label: 'Edit',
              ariaLabel: `Edit project: ${project.title}`,
              icon: Pencil,
              onSelect: () => {
                setEditing(project);
                setFormOpen(true);
              },
            },
            {
              label: 'Delete',
              ariaLabel: `Delete project: ${project.title}`,
              icon: Trash2,
              destructive: true,
              onSelect: () => remove.request(project),
            },
          ]}
          empty={{
            icon: Hammer,
            title: 'No projects yet.',
            description: "Projects appear on the member's public profile.",
            action: { label: 'Add your first project', onClick: openCreate },
          }}
        />
      </FormSection>

      <ProjectFormDialog
        teamMemberId={teamMemberId}
        open={formOpen}
        onOpenChange={setFormOpen}
        project={editing}
      />

      <ConfirmDialog
        {...remove.dialogProps}
        title="Delete this project?"
        description="It is removed from the public profile. This action cannot be undone."
        confirmationText="delete"
      />
    </div>
  );
}
