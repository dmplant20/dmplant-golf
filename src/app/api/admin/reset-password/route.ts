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

function getAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const caller = await getAuthUser()
  if (!caller) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const body = await req.json()
  const { target_user_id, new_password } = body

  if (!target_user_id || !new_password) {
    return NextResponse.json({ error: '필수값 누락 (target_user_id, new_password)' }, { status: 400 })
  }

  if (new_password.length < 8) {
    return NextResponse.json({ error: '비밀번호는 최소 8자 이상이어야 합니다' }, { status: 400 })
  }

  const admin = getAdmin()

  // Allow if: the user is resetting their own password OR they are president/secretary of a shared club
  const isSelf = caller.id === target_user_id

  if (!isSelf) {
    // Find a club where caller is president/secretary AND target is a member
    const { data: callerMems } = await admin
      .from('club_memberships')
      .select('club_id')
      .eq('user_id', caller.id)
      .eq('status', 'approved')
      .in('role', ['president', 'secretary'])

    if (!callerMems || callerMems.length === 0) {
      return NextResponse.json({ error: '권한 없음' }, { status: 403 })
    }

    const clubIds = callerMems.map((m: { club_id: string }) => m.club_id)

    const { data: targetMem } = await admin
      .from('club_memberships')
      .select('id')
      .eq('user_id', target_user_id)
      .eq('status', 'approved')
      .in('club_id', clubIds)
      .single()

    if (!targetMem) {
      return NextResponse.json({ error: '권한 없음 (같은 클럽 회원이 아닙니다)' }, { status: 403 })
    }
  }

  const { error } = await admin.auth.admin.updateUserById(target_user_id, {
    password: new_password,
  })

  if (error) {
    return NextResponse.json({ error: `비밀번호 변경 실패: ${error.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
