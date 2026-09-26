'use client';

import { useEffect } from 'react';
import { RotateCcw } from 'lucide-react';
import { Button } from '@/modules/shared/ui/button';
import { ErrorState } from '@/modules/shared/ui/error-state';

// Error boundary for every public tab. It sits inside the (public) layout, so the masthead and
// navigation stay on screen and the visitor can go elsewhere; only the failed tab's content is
// replaced.
export default function PublicError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <ErrorState
      title="This page didn't load"
      description="Something failed while loading this page. Try again, or come back in a few minutes."
      action={
        <Button onClick={reset}>
          <RotateCcw className="size-4" aria-hidden="true" />
          Try again
        </Button>
      }
    />
  );
}
