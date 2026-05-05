import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

async function getAuthUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function getDb() {
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (svcKey) return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, svcKey, { auth: { persistSession: false } })
  // fallback: use anon key (may fail if RLS blocks)
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => [], setAll: () => {} } })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const body = await req.json()
  const { club_id, year, month, status } = body
  if (!club_id || !year || !month || !status) return NextResponse.json({ error: '필수값 누락' }, { status: 400 })
  if (!['attending', 'absent'].includes(status)) return NextResponse.json({ error: '잘못된 status' }, { status: 400 })

  const db = getDb()

  // Verify club membership
  const { data: mem } = await db.from('club_memberships').select('id').eq('club_id', club_id).eq('user_id', user.id).eq('status', 'approved').single()
  if (!mem) return NextResponse.json({ error: '클럽 멤버가 아닙니다' }, { status: 403 })

  const { error } = await db.from('meeting_attendances').upsert(
    { club_id, year, month, user_id: user.id, status, responded_at: new Date().toISOString() },
    { onConflict: 'club_id,year,month,user_id' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

export async function DELETE(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const body = await req.json()
  const { club_id, year, month } = body
  if (!club_id || !year || !month) return NextResponse.json({ error: '필수값 누락' }, { status: 400 })

  const db = getDb()

  // Can only delete own RSVP (user_id = user.id enforced here)
  const { error } = await db.from('meeting_attendances').delete()
    .eq('club_id', club_id).eq('year', year).eq('month', month).eq('user_id', user.id)
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
