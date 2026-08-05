import { cn } from '@/modules/shared/lib/utils';

// Circular avatar with a subtle ring, per the Figma prototype's profile-photo treatment. Plain
// <img> rather than next/image: profile/team photos come from an admin-configured storage host
// not known at build time (see next.config.ts remotePatterns), so next/image would 404 in
// environments where that host isn't allow-listed yet.
// eslint-disable-next-line @next/next/no-img-element -- external, admin-configured photo host; see above.

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

export function Avatar({ src, alt, fallback, size = 'md', className }: AvatarProps) {
  const base = cn(
    'shrink-0 overflow-hidden rounded-full ring-2 ring-navy-foreground/20',
    SIZE_CLASSES[size],
    className,
  );

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt={alt} className={cn(base, 'object-cover')} loading="lazy" />
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
