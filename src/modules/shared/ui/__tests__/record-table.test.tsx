import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Trash2 } from 'lucide-react';
import { RecordTable } from '../record-table';

type Row = { id: string; name: string; updatedAt: Date };

const rows: Row[] = [
  { id: '1', name: 'Alpha', updatedAt: new Date('2026-09-01T00:00:00Z') },
  { id: '2', name: 'Beta', updatedAt: new Date('2026-09-02T00:00:00Z') },
];

function renderTable(items: Row[], onAdd = vi.fn()) {
  render(
    <RecordTable
      items={items}
      noun="things"
      searchText={(row) => row.name}
      identityHeader="Thing"
      identity={(row) => row.name}
      statusHeader="State"
      status={() => ({ tone: 'ok', label: 'Fine' })}
      groupHeader="Group"
      group={() => 'G'}
      rowLabel={(row) => `Actions: ${row.name}`}
      actions={(row) => [
        {
          label: 'Delete',
          ariaLabel: `Delete: ${row.name}`,
          icon: Trash2,
          destructive: true,
          onSelect: vi.fn(),
        },
      ]}
      empty={{
        icon: Trash2,
        title: 'No things yet.',
        description: 'Add one.',
        action: { label: 'Add your first thing', onClick: onAdd },
      }}
    />,
  );
  return onAdd;
}

describe('RecordTable', () => {
  it('offers the first-record call to action when empty', async () => {
    const onAdd = renderTable([]);
    await userEvent.click(screen.getByRole('button', { name: 'Add your first thing' }));
    expect(onAdd).toHaveBeenCalled();
    expect(screen.queryByRole('searchbox')).not.toBeInTheDocument();
  });

  it('filters rows by search and clears back to the full list', async () => {
    const user = userEvent.setup();
    renderTable(rows);

    await user.type(screen.getByRole('searchbox', { name: 'Search things' }), 'bet');
    expect(screen.queryByRole('row', { name: /Alpha/ })).not.toBeInTheDocument();
    expect(screen.getByRole('row', { name: /Beta/ })).toBeInTheDocument();

    await user.clear(screen.getByRole('searchbox'));
    await user.type(screen.getByRole('searchbox'), 'zzz');
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Clear search' }));
    expect(screen.getAllByRole('row')).toHaveLength(3);
  });
});
