'use client';

import { useState } from 'react';
import Image from 'next/image';

import { cn } from '@/modules/shared/lib/utils';

// Circular avatar with a subtle ring, per the Figma prototype's profile-photo treatment. Uses
// next/image: the R2 photo host is allow-listed in next.config.ts's remotePatterns (derived from
// R2_PUBLIC_URL). Client component so a failed load (host not allow-listed, R2_PUBLIC_URL unset in
// this environment, photo deleted, etc.) can fall back to the initials placeholder instead of
// showing a broken-image icon — next/image has no onError-as-props equivalent that works from a
// Server Component.

export interface AvatarProps {
  src?: string | null;
  /** Meaningful alt text — required, never decorative for a person's photo. */
  alt: string;
  /** Fallback initials shown when there is no photo. */
  fallback: string;
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const SIZE_CLASSES: Record<NonNullable<AvatarProps['size']>, string> = {
  sm: 'size-10 text-sm',
  md: 'size-16 text-lg',
  lg: 'size-28 text-3xl sm:size-32',
};

// Fixed pixel pairs for the non-responsive sizes — next/image needs explicit width/height when
// not using `fill`. `lg` is responsive (112px below the `sm` breakpoint, 128px at/above it), so it
// can't be expressed as one fixed pair; it uses `fill` on a sized wrapper instead (see below).
const FIXED_PIXEL_SIZES: Record<'sm' | 'md', number> = {
  sm: 40,
  md: 64,
};

export function Avatar({ src, alt, fallback, size = 'md', className }: AvatarProps) {
  const [failed, setFailed] = useState(false);
  const base = cn(
    'shrink-0 overflow-hidden rounded-full ring-2 ring-navy-foreground/20',
    SIZE_CLASSES[size],
    className,
  );

  if (src && !failed) {
    if (size === 'lg') {
      return (
        <div className={cn(base, 'relative')}>
          <Image
            src={src}
            alt={alt}
            fill
            sizes="(min-width: 640px) 128px, 112px"
            className="object-cover"
            onError={() => setFailed(true)}
          />
        </div>
      );
    }

    return (
      <Image
        src={src}
        alt={alt}
        width={FIXED_PIXEL_SIZES[size]}
        height={FIXED_PIXEL_SIZES[size]}
        className={cn(base, 'object-cover')}
        onError={() => setFailed(true)}
      />
    );
  }

  return (
    <div
      role="img"
      aria-label={alt}
      className={cn(
        base,
        'flex items-center justify-center bg-muted font-semibold text-muted-foreground',
      )}
    >
      {fallback}
    </div>
  );
}
