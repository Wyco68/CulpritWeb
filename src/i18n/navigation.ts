import { createNavigation } from 'next-intl/navigation';
import { routing } from './routing';

// Typed navigation wrappers — use these instead of next/link & next/navigation
// so locale routing stays consistent as languages are added.
export const { Link, redirect, usePathname, useRouter, getPathname } =
  createNavigation(routing);
