'use client';

import { useEffect } from 'react';
import './globals.css';

// Last-resort boundary: replaces the root layout itself when that layout fails, so it renders its
// own <html> and cannot rely on the fonts or providers the layout would have set up. Kept to the
// system font stack and plain tokens on purpose — the one screen that must render no matter what.
export default function GlobalError({
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
    <html lang="en">
      <body className="flex min-h-[100dvh] items-center justify-center bg-background px-6 text-foreground">
        <main className="max-w-md">
          <h1 className="font-serif text-title">The site didn&apos;t load</h1>
          <p className="mt-4 text-pretty leading-relaxed text-muted-foreground">
            Something failed on our side. Try again, or come back in a few minutes.
          </p>
          <button
            type="button"
            onClick={reset}
            className="focus-ring mt-8 inline-flex h-11 items-center rounded-sm bg-accent px-6 text-sm font-medium text-accent-foreground hover:bg-accent/90"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
