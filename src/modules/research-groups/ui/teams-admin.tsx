'use client';

import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import { Check, Plus, Trash2, UsersRound } from 'lucide-react';
import { apiSend } from '@/modules/shared/lib/api-client';
import { useDeleteRecord } from '@/modules/shared/lib/use-delete-record';
import { Button } from '@/modules/shared/ui/button';
import { ConfirmDialog } from '@/modules/shared/ui/confirm-dialog';
import { FormSection, FormSectionCount } from '@/modules/shared/ui/form-section';
import { Input } from '@/modules/shared/ui/input';
import { IconButton } from '@/modules/shared/ui/tooltip';
// Deep imports, not the barrel — see team-member-form-dialog.tsx.
import type { Team } from '../team.types';

// The admin's own teams (ADR-020): the headings the public Team tab groups members under. Named
// and ordered here; which team a member is on is set in that member's details. Edited inline — a
// team is one name and one number, too little to justify a dialog.

type Draft = { name: string; sortOrder: number };

function errorMessage(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function TeamRow({ team, onDelete }: { team: Team; onDelete: (team: Team) => void }) {
  const router = useRouter();
  const [draft, setDraft] = useState<Draft>({ name: team.name, sortOrder: team.sortOrder });
  const dirty = draft.name.trim() !== team.name || draft.sortOrder !== team.sortOrder;

  const save = useMutation({
    mutationFn: () =>
      apiSend<Team>('PUT', `/api/admin/teams/${team.id}`, {
        name: draft.name,
        sortOrder: draft.sortOrder,
      }),
    onSuccess: () => {
      toast.success('Team saved.');
      router.refresh();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not save the team.')),
  });

  return (
    <form
      className="flex flex-wrap items-center gap-2"
      onSubmit={(event) => {
        event.preventDefault();
        if (dirty && draft.name.trim()) save.mutate();
      }}
    >
      <Input
        aria-label={`Name of ${team.name}`}
        value={draft.name}
        maxLength={100}
        onChange={(event) => setDraft({ ...draft, name: event.target.value })}
        className="min-w-0 flex-1"
      />
      <Input
        aria-label={`Position of ${team.name}`}
        type="number"
        min={0}
        inputMode="numeric"
        value={draft.sortOrder}
        onChange={(event) => setDraft({ ...draft, sortOrder: Number(event.target.value) || 0 })}
        className="w-20"
      />
      <span className="w-24 text-xs text-muted-foreground tabular">
        {team.memberCount} {team.memberCount === 1 ? 'member' : 'members'}
      </span>
      <Button
        type="submit"
        size="sm"
        variant="outline"
        disabled={!dirty || !draft.name.trim()}
        loading={save.isPending}
        aria-label={`Save ${team.name}`}
      >
        <Check className="size-4" aria-hidden="true" />
        Save
      </Button>
      <IconButton
        type="button"
        variant="ghost"
        label={`Delete ${team.name}`}
        className="size-9 text-muted-foreground hover:text-destructive"
        onClick={() => onDelete(team)}
      >
        <Trash2 className="size-4" aria-hidden="true" />
      </IconButton>
    </form>
  );
}

export function TeamsAdmin({ teams }: { teams: Team[] }) {
  const router = useRouter();
  const [name, setName] = useState('');
  const remove = useDeleteRecord<Team>((id) => `/api/admin/teams/${id}`);

  const create = useMutation({
    mutationFn: () =>
      apiSend<Team>('POST', '/api/admin/teams', {
        name,
        // New teams go last; the admin can move them with the position number.
        sortOrder: teams.reduce((max, team) => Math.max(max, team.sortOrder), 0) + 1,
      }),
    onSuccess: () => {
      toast.success('Team added.');
      setName('');
      router.refresh();
    },
    onError: (error) => toast.error(errorMessage(error, 'Could not add the team.')),
  });

  const members = remove.target?.memberCount ?? 0;

  return (
    <div id="teams" className="scroll-mt-24">
      <FormSection
        title="Teams"
        description="The groups on the public Team tab, in position order (lower first). The director is always shown on their own at the top."
        badge={<FormSectionCount count={teams.length} />}
      >
        <div className="flex flex-col gap-3">
          {teams.length === 0 ? (
            <p className="flex items-center gap-2 text-sm text-muted-foreground">
              <UsersRound className="size-4" aria-hidden="true" />
              No teams yet — every member is listed together.
            </p>
          ) : (
            teams.map((team) => (
              // Keyed on `updatedAt` too, so a saved row re-seeds its draft from the fresh data.
              <TeamRow
                key={`${team.id}-${team.updatedAt.valueOf()}`}
                team={team}
                onDelete={remove.request}
              />
            ))
          )}

          <form
            className="mt-2 flex flex-wrap items-center gap-2 border-t border-border pt-4"
            onSubmit={(event) => {
              event.preventDefault();
              if (name.trim()) create.mutate();
            }}
          >
            <Input
              aria-label="New team name"
              placeholder="New team, e.g. “Alumni”"
              value={name}
              maxLength={100}
              onChange={(event) => setName(event.target.value)}
              className="min-w-0 flex-1"
            />
            <Button type="submit" size="sm" disabled={!name.trim()} loading={create.isPending}>
              <Plus className="size-4" aria-hidden="true" />
              Add team
            </Button>
          </form>
        </div>
      </FormSection>

      <ConfirmDialog
        {...remove.dialogProps}
        title="Delete this team?"
        description={
          members > 0
            ? `Its ${members} ${members === 1 ? 'member stays' : 'members stay'} on the site, listed without a team until you give them another.`
            : 'Nobody is on this team.'
        }
      />
    </div>
  );
}
