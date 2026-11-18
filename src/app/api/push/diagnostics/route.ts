// Containment: no legacy-role trust, service-role access or network side effects.
// Restore only after reviewed authority, exact recipient scope and safe transport.
export async function GET() {
  return Response.json({ error: 'PUSH_DIAGNOSTICS_PENDING_AUTHORITY_VERIFICATION' }, { status: 403, headers: { 'Cache-Control': 'no-store' } })
}
