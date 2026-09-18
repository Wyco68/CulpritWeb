'use client';

import { useState } from 'react';
import { FlaskConical, Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useDeleteRecord } from '@/modules/shared/lib/use-delete-record';
import { useEditFromQuery } from '@/modules/shared/lib/use-edit-from-query';
import { Button } from '@/modules/shared/ui/button';
import { ConfirmDialog } from '@/modules/shared/ui/confirm-dialog';
import { FormSection, FormSectionCount } from '@/modules/shared/ui/form-section';
import { RecordIdentity, RecordTable } from '@/modules/shared/ui/record-table';
// Deep import, not the barrel — see research-form-dialog.tsx's comment.
import type { Research } from '../research.types';
import { ResearchFormDialog } from './research-form-dialog';

export function ResearchTable({
  items,
  suggestions = [],
}: {
  items: Research[];
  /** Lab member names offered in the byline field. Defaults to none so the table renders alone. */
  suggestions?: readonly string[];
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Research | undefined>(undefined);

  const remove = useDeleteRecord<Research>((id) => `/api/admin/research/${id}`);

  useEditFromQuery(items, (item) => {
    setEditing(item);
    setFormOpen(true);
  });

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  return (
    <div id="works" className="scroll-mt-24">
      <FormSection
        title="Research works"
        description="The list on the public Research tab, ordered by each work's sort order."
        badge={<FormSectionCount count={items.length} />}
        action={
          <Button aria-label="Add research work" onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" />
            Add
          </Button>
        }
      >
        <RecordTable
          items={items}
          noun="research works"
          searchText={(item) =>
            [item.title, item.area, ...item.contributors.map((person) => person.name)].join(' ')
          }
          identityHeader="Work"
          identity={(item) => (
            <RecordIdentity
              title={item.title}
              detail={
                item.contributors.length > 0
                  ? `With ${item.contributors.map((person) => person.name).join(', ')}`
                  : undefined
              }
            />
          )}
          statusHeader="Link"
          status={(item) =>
            item.link
              ? { tone: 'ok', label: 'Linked', icon: Link2 }
              : { tone: 'neutral', label: 'No link' }
          }
          groupHeader="Area"
          group={(item) => (
            <span className="block max-w-[22ch] truncate" title={item.area}>
              {item.area}
            </span>
          )}
          rowLabel={(item) => `Actions: ${item.title}`}
          actions={(item) => [
            {
              label: 'Edit',
              ariaLabel: `Edit: ${item.title}`,
              icon: Pencil,
              onSelect: () => {
                setEditing(item);
                setFormOpen(true);
              },
            },
            {
              label: 'Delete',
              ariaLabel: `Delete: ${item.title}`,
              icon: Trash2,
              destructive: true,
              onSelect: () => remove.request(item),
            },
          ]}
          empty={{
            icon: FlaskConical,
            title: 'No research works yet.',
            description: 'Works appear on the public Research tab, grouped by area.',
            action: { label: 'Add your first research work', onClick: openCreate },
          }}
        />
      </FormSection>

      <ResearchFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        research={editing}
        suggestions={suggestions}
      />

      <ConfirmDialog
        {...remove.dialogProps}
        title="Delete this item?"
        description="This action cannot be undone."
        confirmationText="delete"
      />
    </div>
  );
}
