import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function makeSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )
}

export async function POST(req: NextRequest) {
  const supabase = await makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  let body: { clubId?: string; year?: number; month?: number; status?: string; reason?: string }
  try {
    body = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const { clubId, year, month, status, reason } = body

  if (!clubId || !year || !month || !status) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  if (status !== 'attending' && status !== 'not_attending') {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { error } = await supabase.from('meeting_attendances').upsert(
    {
      club_id: clubId,
      user_id: user.id,
      year,
      month,
      status,
      reason: reason ?? null,
      responded_at: new Date().toISOString(),
    },
    { onConflict: 'club_id,user_id,year,month' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
