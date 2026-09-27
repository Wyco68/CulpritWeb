'use client';

import { ArrowUpRight } from 'lucide-react';
import { Dialog } from '@/modules/shared/ui/dialog';
import { linkPillClassName } from '@/modules/shared/ui/card';
import { PhotoGallery } from '@/modules/shared/ui/photo-gallery';
// Deep imports, not the barrels: both barrels re-export services whose composition roots pull
// Prisma (Node-only) into the browser bundle — see the note in research-form-dialog.tsx.
import { BylineNames } from '@/modules/research-groups/ui/byline-names';
import type { BylineMember } from '@/modules/research-groups/byline-match';
import type { Research } from '../research.types';

// Everything about one research work: the full summary the card clamps, who worked on it, the
// project link, and its gallery shown uncropped. The same shape as the event detail dialog, so
// the two card grids behave alike (ADR-019).

export function ResearchDetailDialog({
  open,
  onOpenChange,
  research,
  members,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  research?: Research;
  members: readonly BylineMember[];
}) {
  if (!research) return null;

  const hasPhotos = research.photoUrls.length > 0;

  return (
    <Dialog
      open={open}
      onOpenChange={onOpenChange}
      title={research.title}
      description={research.area}
      closeLabel="Close"
      // As in the event dialog: the tall, wide size only when there is a gallery to give room to.
      size={hasPhotos ? 'xl' : 'lg'}
      className={hasPhotos ? 'h-[85dvh]' : undefined}
    >
      {/* `whitespace-pre-line` so the paragraph breaks the admin typed survive — the summary is
          plain text (HTML is stripped at the schema boundary). */}
      <p className="max-w-[62ch] whitespace-pre-line text-pretty leading-[1.7] text-muted-foreground">
        {research.summary}
      </p>

      {research.contributors.length > 0 && (
        <p className="mt-4 text-sm text-muted-foreground">
          With{' '}
          <BylineNames
            names={research.contributors.map((contributor) => contributor.name)}
            members={members}
          />
        </p>
      )}

      {research.link && (
        <div className="mt-5">
          <a
            href={research.link}
            target="_blank"
            rel="noopener noreferrer"
            className={linkPillClassName}
          >
            <ArrowUpRight className="size-3.5" aria-hidden="true" />
            View Project
            <span className="sr-only"> (opens in a new tab)</span>
          </a>
        </div>
      )}

      {hasPhotos && (
        <PhotoGallery urls={research.photoUrls} title={research.title} className="mt-6" />
      )}
    </Dialog>
  );
}
