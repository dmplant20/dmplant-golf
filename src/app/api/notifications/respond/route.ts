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

  // status 정규화 — 팝업은 과거 'not_attending' 을 보냈으나 meeting_attendances CHECK 는
  // ('attending','absent') 만 허용한다. meetings/rsvp 경로와 동일하게 'absent' 로 통일.
  // (구버전 클라이언트 호환을 위해 'not_attending' 도 계속 받아 정규화)
  let normalized: 'attending' | 'absent'
  if (status === 'attending') normalized = 'attending'
  else if (status === 'absent' || status === 'not_attending') normalized = 'absent'
  else return NextResponse.json({ error: 'Invalid status' }, { status: 400 })

  const { error } = await supabase.from('meeting_attendances').upsert(
    {
      club_id: clubId,
      user_id: user.id,
      year,
      month,
      status: normalized,
      reason: reason ?? null,
      responded_at: new Date().toISOString(),
    },
    { onConflict: 'club_id,user_id,year,month' }
  )

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ ok: true })
}
