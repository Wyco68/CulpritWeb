import type { ReactNode } from 'react';
import { Providers } from '../providers';

// The query client and the toaster serve the admin app and the login form only. They used to wrap
// the root layout, which shipped react-query and sonner to every public page view for nothing —
// the public site shows no toasts and runs no client-side queries.
export default function AdminGroupLayout({ children }: { children: ReactNode }) {
  return <Providers>{children}</Providers>;
}
