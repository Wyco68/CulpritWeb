'use client';

import { useState } from 'react';
import { ArrowRight, Images, Link2 } from 'lucide-react';
import { Button } from '@/modules/shared/ui/button';
import { contentCardClassName } from '@/modules/shared/ui/card';
import { CardPhoto } from '@/modules/shared/ui/card-photo';
import { resolveCover } from '@/modules/shared/lib/cover-crop';
// Deep imports, not the barrels — see the note in research-detail-dialog.tsx.
import { BylineNames } from '@/modules/research-groups/ui/byline-names';
import type { BylineMember } from '@/modules/research-groups/byline-match';
import type { Research } from '../research.types';
import { ResearchDetailDialog } from './research-detail-dialog';

// One area's research works as cards — a client island only because of the detail dialog. Built
// like the event cards (ADR-019): a cropped cover, the title, a clamped summary and the byline,
// with a Show Details button pinned to the foot so the buttons line up across a row whatever each
// summary's length. The full summary, the project link and the gallery live in the dialog.

export function ResearchCards({
  items,
  members,
}: {
  items: Research[];
  members: readonly BylineMember[];
}) {
  const [openId, setOpenId] = useState<string | null>(null);
  // Read from `items` rather than holding the object, so a refresh can't leave a stale copy open.
  const open = items.find((item) => item.id === openId);

  return (
    <>
      {/* Three cards to a row when the content column is wide, two when it is medium, one on a
          phone — sized by the column (`main` is a container), not the viewport. */}
      <ul className="grid gap-5 @xl:grid-cols-2 @4xl:grid-cols-3">
        {items.map((item) => (
          <li key={item.id} className={contentCardClassName}>
            <CardPhoto {...resolveCover(item)} />

            <div className="flex flex-1 flex-col p-6">
              <h4 className="text-balance break-words font-serif text-xl leading-snug text-foreground">
                {item.title}
              </h4>
              {/* Clamped so a long summary cannot stretch one card past its neighbours. */}
              <p className="mt-2 line-clamp-3 text-pretty break-words leading-[1.7] text-muted-foreground">
                {item.summary}
              </p>
              {/* Omitted entirely when nobody is credited — that means it is the lab's own work. */}
              {item.contributors.length > 0 && (
                <p className="mt-3 text-sm text-muted-foreground">
                  With{' '}
                  <BylineNames
                    names={item.contributors.map((contributor) => contributor.name)}
                    members={members}
                  />
                </p>
              )}

              <div className="mt-auto flex flex-wrap items-center justify-between gap-3 pt-5">
                {item.photoUrls.length > 0 || item.link ? (
                  <ul className="flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
                    {item.photoUrls.length > 0 && (
                      <li className="inline-flex items-center gap-1">
                        <Images className="size-4" aria-hidden="true" />
                        <span className="tabular">{item.photoUrls.length}</span>
                        <span className="sr-only">
                          {' '}
                          photo{item.photoUrls.length === 1 ? '' : 's'}
                        </span>
                      </li>
                    )}
                    {item.link && (
                      <li className="inline-flex items-center gap-1">
                        <Link2 className="size-4" aria-hidden="true" />
                        <span className="sr-only">Has a project link</span>
                      </li>
                    )}
                  </ul>
                ) : (
                  <span />
                )}
                <Button
                  variant="outline"
                  size="sm"
                  aria-label={`Show Details: ${item.title}`}
                  onClick={() => setOpenId(item.id)}
                >
                  Show Details
                  <ArrowRight className="size-4" aria-hidden="true" />
                </Button>
              </div>
            </div>
          </li>
        ))}
      </ul>

      <ResearchDetailDialog
        open={Boolean(open)}
        onOpenChange={(next) => !next && setOpenId(null)}
        research={open}
        members={members}
      />
    </>
  );
}
