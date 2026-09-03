import { redirect } from 'next/navigation';

// Moved: the admin IA now mirrors the public tabs, so this screen's content lives on
// /admin/team. Kept as a redirect so existing bookmarks and links still land somewhere.
export default function MovedPage() {
  redirect('/admin/team');
}
