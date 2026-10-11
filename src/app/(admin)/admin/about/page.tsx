import { redirect } from 'next/navigation';

// Renamed to /admin/identity when the public About tab was removed. Kept as a redirect so existing
// bookmarks still land somewhere.
export default function MovedPage() {
  redirect('/admin/identity');
}
