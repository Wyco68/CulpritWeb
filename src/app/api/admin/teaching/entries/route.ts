import type { NextRequest } from 'next/server';
import { getCvEntryService, createCvEntrySchema } from '@/modules/teaching';
import { requireAdmin } from '@/modules/auth';
import {
  apiError,
  apiUnexpected,
  apiValidationError,
  respond,
} from '@/modules/shared/lib/api-response';
import { revalidateOn } from '@/modules/shared/lib/revalidate';
import { readJsonBody } from '@/modules/shared/lib/request';

//
// Both public areas are purged regardless of which section the entry landed in: `section` is
// editable, so a single edit can move an entry from About to Teaching and back, and working out
// which pages *actually* changed would mean comparing before and after for no practical gain.
export async function POST(request: NextRequest) {
  try {
    const admin = await requireAdmin();
    if (!admin.ok) return apiError(admin.error);

    const parsed = createCvEntrySchema.safeParse(await readJsonBody(request));
    if (!parsed.success) return apiValidationError(parsed.error);

    const result = await getCvEntryService().create(parsed.data, `admin:${admin.data.userId}`);
    return respond(revalidateOn(result, 'teaching', 'about'), 201);
  } catch (error) {
    return apiUnexpected(error);
  }
}
