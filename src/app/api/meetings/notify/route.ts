// Pause external notifications until recipient authority and idempotency are reviewed.
export async function GET(request: Request) {
  const secret = process.env.CRON_SECRET
  if (!secret) return Response.json({ error: 'CRON_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  if (request.headers.get('authorization') !== `Bearer ${secret}`) {
    return Response.json({ error: 'UNAUTHENTICATED' }, { status: 401, headers: { 'Cache-Control': 'no-store' } })
  }
  return Response.json({ error: 'MEETING_NOTIFICATIONS_PENDING_RECIPIENT_VERIFICATION' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
}
