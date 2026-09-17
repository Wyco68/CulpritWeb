'use client';

import { useState } from 'react';
import { ExternalLink, FileText, Link2, Pencil, Plus, Trash2 } from 'lucide-react';
import { useDeleteRecord } from '@/modules/shared/lib/use-delete-record';
import { Button } from '@/modules/shared/ui/button';
import { FormSection, FormSectionCount } from '@/modules/shared/ui/form-section';
import { ConfirmDialog } from '@/modules/shared/ui/confirm-dialog';
import { RecordIdentity, RecordTable } from '@/modules/shared/ui/record-table';
import type { RowAction } from '@/modules/shared/ui/row-actions-menu';
// Deep import, not the barrel — see publication-form-dialog.tsx's comment.
import type { Publication } from '../publication.types';
import { PublicationFormDialog } from './publication-form-dialog';

export function PublicationsTable({
  items,
  suggestions = [],
}: {
  items: Publication[];
  /** Lab member names offered in the byline field. Defaults to none so the table renders alone. */
  suggestions?: readonly string[];
}) {
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Publication | undefined>(undefined);

  const remove = useDeleteRecord<Publication>((id) => `/api/admin/publications/${id}`);

  function openCreate() {
    setEditing(undefined);
    setFormOpen(true);
  }

  function actionsFor(item: Publication): RowAction[] {
    const open: RowAction[] = item.link
      ? [
          {
            label: 'Open link',
            ariaLabel: `Open link: ${item.title}`,
            icon: ExternalLink,
            onSelect: () => window.open(item.link!, '_blank', 'noopener,noreferrer'),
          },
        ]
      : [];
    return [
      ...open,
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
    ];
  }

  return (
    <div id="publications" className="scroll-mt-24">
      <FormSection
        title="Publications"
        description="Every peer-reviewed entry on the public Publications tab, newest year first."
        badge={<FormSectionCount count={items.length} />}
        action={
          <Button aria-label="Add publication" onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" />
            Add
          </Button>
        }
      >
        <RecordTable
          items={items}
          noun="publications"
          searchText={(item) =>
            [item.title, item.venue, String(item.year), ...item.authors.map((a) => a.name)].join(
              ' ',
            )
          }
          identityHeader="Publication"
          identity={(item) => <RecordIdentity title={item.title} detail={item.venue} />}
          statusHeader="Link"
          status={(item) =>
            item.link
              ? { tone: 'ok', label: 'Linked', icon: Link2 }
              : { tone: 'attention', label: 'No link' }
          }
          groupHeader="Year"
          group={(item) => <span className="tabular">{item.year}</span>}
          rowLabel={(item) => `Actions: ${item.title}`}
          actions={actionsFor}
          empty={{
            icon: FileText,
            title: 'No publications yet.',
            description: 'Publications appear on the public Publications tab, newest year first.',
            action: { label: 'Add your first publication', onClick: openCreate },
          }}
        />
      </FormSection>

      <PublicationFormDialog
        open={formOpen}
        onOpenChange={setFormOpen}
        publication={editing}
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
