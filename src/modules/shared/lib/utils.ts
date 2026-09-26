import { clsx, type ClassValue } from 'clsx';
import { extendTailwindMerge } from 'tailwind-merge';

// tailwind-merge only knows Tailwind's stock font sizes. The project's own type-scale tokens
// (globals.css `--text-*`) would otherwise be read as colours, and `cn('text-heading text-accent')`
// would drop the size as a "conflict" with the colour. Registering them keeps size and colour
// separate.
const twMerge = extendTailwindMerge({
  extend: { theme: { text: ['display', 'title', 'heading', 'standfirst'] } },
});

/** Merge Tailwind class names with conflict resolution. Used by all shadcn/ui primitives. */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
