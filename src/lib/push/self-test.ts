import type { SupabaseClient } from '@supabase/supabase-js'

type Subscription = { endpoint: string; p256dh: string; auth: string }
type Sender = (subscription: Subscription) => Promise<unknown>
const headers = { 'Cache-Control': 'no-store' }
const fail = (status: number, error: string) => Response.json({ error }, { status, headers })

// Exact delivery service hosts only. No caller URLs, IP addresses, credentials,
// custom ports or redirects. Unknown providers fail closed until separately reviewed.
export function safePushSubscription(value: Subscription): boolean {
  if (!value || typeof value.endpoint !== 'string' || value.endpoint.length > 4096) return false
  try {
    const url = new URL(value.endpoint)
    if (url.protocol !== 'https:' || url.port || url.username || url.password || url.hash) return false
    if (!['fcm.googleapis.com', 'updates.push.services.mozilla.com', 'web.push.apple.com'].includes(url.hostname)) return false
    if (url.pathname === '/') return false
    return typeof value.p256dh === 'string' && /^[A-Za-z0-9_-]{87}=?$/.test(value.p256dh)
      && typeof value.auth === 'string' && /^[A-Za-z0-9_-]{22}={0,2}$/.test(value.auth)
  } catch { return false }
}

export async function selfPushTest(request: Request, db: SupabaseClient, send: Sender, configured: boolean) {
  const origin = request.headers.get('origin')
  if (origin && origin !== new URL(request.url).origin) return fail(403, 'ORIGIN_DENIED')
  const { data: { user }, error } = await db.auth.getUser()
  if (error || !user) return fail(401, 'UNAUTHENTICATED')
  let body: Record<string, unknown>
  try { body = await request.json() } catch { return fail(400, 'INVALID_REQUEST') }
  if (!body || typeof body !== 'object' || Array.isArray(body)) return fail(400, 'INVALID_REQUEST')
  if (body.mode !== 'self') return fail(403, 'PUSH_MANAGEMENT_PENDING_AUTHORITY_VERIFICATION')
  // Reject a target even in self mode, avoiding confused-target confirmation.
  if (body.target_user_id || body.user_ids || body.endpoint) return fail(400, 'SELF_ONLY')
  if (!configured) return fail(503, 'PUSH_UNAVAILABLE')
  // Authenticated RLS client, actual actor only. No service key, profile lookup,
  // club association, native-token access, logs or subscription deletion.
  const subscriptions = await db.from('push_subscriptions').select('endpoint,p256dh,auth')
    .eq('user_id', user.id).limit(6)
  if (subscriptions.error) return fail(503, 'SUBSCRIPTIONS_UNAVAILABLE')
  const rows: Subscription[] = subscriptions.data ?? []
  if (rows.length > 5) return fail(409, 'TOO_MANY_SUBSCRIPTIONS')
  if (rows.some(row => !safePushSubscription(row))) return fail(409, 'SUBSCRIPTION_REVIEW_REQUIRED')
  let sent = 0, failed = 0
  for (const row of rows) {
    try { await send(row); sent++ } catch { failed++ }
  }
  return Response.json({ ok: failed === 0, sent, failed, skipped: rows.length === 0 ? 1 : 0, total: rows.length, details: [], scope: 'self_web_push' }, { status: failed ? 502 : 200, headers })
}
