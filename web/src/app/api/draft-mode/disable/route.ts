/**
 * GET /api/draft-mode/disable — leave preview.
 *
 * Clears the Next draft-mode cookie and redirects to the homepage. Safe with
 * zero env configured (disabling draft mode is always a no-op-safe operation).
 */

import { draftMode } from 'next/headers';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  (await draftMode()).disable();
  return Response.redirect(new URL('/', request.url), 307);
}
