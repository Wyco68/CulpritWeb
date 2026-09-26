'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import { RotateCcw } from 'lucide-react';
import { Button, buttonVariants } from '@/modules/shared/ui/button';
import { ErrorState } from '@/modules/shared/ui/error-state';

// Error boundary for every admin screen. Inside the admin layout, so the session gate has already
// passed and the navigation stays usable. Nothing unsaved is lost to it: forms keep their own
// state until a save succeeds, and a failed save is reported by the form itself.
export default function AdminError({
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
      title="This screen didn't load"
      description="Something failed while loading this screen. Try again. If it keeps happening, the database may be unreachable."
      action={
        <>
          <Button onClick={reset}>
            <RotateCcw className="size-4" aria-hidden="true" />
            Try again
          </Button>
          <Link href="/admin" className={buttonVariants({ variant: 'outline' })}>
            Go to dashboard
          </Link>
        </>
      }
    />
  );
}
