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

// 노출되지 않는 랜덤 내부 비밀번호 (첫 로그인은 매직링크로 진행)
function randomInternalPassword() {
  return crypto.randomUUID() + crypto.randomUUID()
}

export async function POST(req: NextRequest) {
  const caller = await getAuthUser()
  if (!caller) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const body = await req.json()
  const { club_id, full_name, full_name_en, name_abbr, email, role } = body

  if (!club_id || !full_name || !email || !role) {
    return NextResponse.json({ error: '필수값 누락 (club_id, full_name, email, role)' }, { status: 400 })
  }

  const admin = getAdmin()

  // 권한 확인 (회장/총무/개발자)
  const { data: callerUser } = await admin.from('users').select('is_developer').eq('id', caller.id).single()
  const { data: callerMem }  = await admin.from('club_memberships').select('role')
    .eq('club_id', club_id).eq('user_id', caller.id).eq('status', 'approved').single()

  const canCreate = callerUser?.is_developer || (callerMem && ['president', 'secretary'].includes(callerMem.role))
  if (!canCreate) {
    return NextResponse.json({ error: '권한 없음 (회장/총무만 가능)' }, { status: 403 })
  }

  // Auth 계정 생성 (내부 랜덤 비번 — 사용자에게 노출 안 됨)
  let authUserId: string
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: randomInternalPassword(),
    email_confirm: true,
  })

  if (createErr) {
    if (createErr.message?.toLowerCase().includes('already') || createErr.message?.toLowerCase().includes('duplicate')) {
      const { data: existingUser } = await admin.from('users').select('id').eq('email', email).single()
      if (!existingUser) {
        return NextResponse.json({ error: `이미 등록된 이메일: ${createErr.message}` }, { status: 409 })
      }
      authUserId = existingUser.id

      const { data: existingMem } = await admin.from('club_memberships').select('id')
        .eq('club_id', club_id).eq('user_id', authUserId).single()
      if (existingMem) {
        return NextResponse.json({ error: '이미 이 클럽의 회원입니다' }, { status: 409 })
      }

      // 기존 계정도 첫 로그인 플래그 설정
      await admin.from('users').update({ needs_password_reset: true }).eq('id', authUserId)
    } else {
      return NextResponse.json({ error: `계정 생성 실패: ${createErr.message}` }, { status: 500 })
    }
  } else {
    authUserId = created.user.id
    // upsert (트리거 충돌 방지)
    const { error: upsertErr } = await admin.from('users').upsert({
      id: authUserId, email, full_name,
      full_name_en: full_name_en || null,
      name_abbr: name_abbr || null,
      needs_password_reset: true,
    }, { onConflict: 'id' })

    if (upsertErr) {
      await admin.auth.admin.deleteUser(authUserId)
      return NextResponse.json({ error: `users 테이블 오류: ${upsertErr.message}` }, { status: 500 })
    }
  }

  // 멤버십 생성
  const { error: memErr } = await admin.from('club_memberships').insert({
    club_id, user_id: authUserId, role,
    status: 'approved',
    joined_at: new Date().toISOString(),
  })

  if (memErr) {
    return NextResponse.json({ error: `멤버십 생성 실패: ${memErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, email, full_name })
}
