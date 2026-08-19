/**
 * POST /api/revalidate — Sanity webhook → Next cache-tag invalidation.
 *
 * Sanity is configured (Manage → API → Webhooks) to POST document changes here
 * with an HMAC signature. `parseBody` (next-sanity/webhook) verifies it against
 * `SANITY_REVALIDATE_SECRET`, then the changed document's `_type` — which is
 * exactly the cache tag `sanityFetch` registered — is revalidated, so the next
 * request re-fetches fresh published content.
 *
 * GUARDS (INVARIANT 1): 503 when the secret is unset (webhook not configured),
 * 401 on a bad signature, 400 with no `_type`; the whole handler is wrapped so
 * no throw ever escapes.
 */

import { revalidateTag } from 'next/cache';
import { NextResponse, type NextRequest } from 'next/server';
import { parseBody } from 'next-sanity/webhook';
import { serverEnv } from '@/lib/env';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

interface WebhookBody {
  _type?: string;
}

export async function POST(req: NextRequest): Promise<NextResponse> {
  try {
    const secret = serverEnv().sanityRevalidateSecret;
    if (!secret) {
      return new NextResponse(
        'Revalidation is not configured — set SANITY_REVALIDATE_SECRET.',
        { status: 503 },
      );
    }

    const { isValidSignature, body } = await parseBody<WebhookBody>(
      req,
      secret,
    );

    if (!isValidSignature) {
      return new NextResponse('Invalid signature', { status: 401 });
    }
    if (!body?._type) {
      return new NextResponse('Missing _type in webhook body', { status: 400 });
    }

    revalidateTag(body._type, 'max');
    return NextResponse.json({
      revalidated: true,
      tag: body._type,
      now: Date.now(),
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unexpected error';
    return new NextResponse(message, { status: 500 });
  }
}
