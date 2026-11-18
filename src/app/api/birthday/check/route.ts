// Cron is paused while historical memberships and notification recipients are
// reconciled. Even an authenticated cron must not revive unverified authority.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return Response.json({ error: 'CRON_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  return Response.json({ error: 'BIRTHDAY_NOTIFICATIONS_PENDING_RECIPIENT_VERIFICATION' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
}
