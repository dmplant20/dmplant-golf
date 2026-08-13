import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const { email, password } = await req.json()
  if (!email || !password) {
    return NextResponse.json({ error: '이메일과 비밀번호 필요' }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: '비밀번호는 6자 이상이어야 합니다' }, { status: 400 })
  }

  const admin = getAdmin()

  // 이메일로 유저 조회
  const { data: profile } = await admin
    .from('users')
    .select('id, needs_password_reset')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (!profile) {
    return NextResponse.json({ error: '등록되지 않은 이메일입니다' }, { status: 404 })
  }
  if (!profile.needs_password_reset) {
    return NextResponse.json({ error: '이미 비밀번호가 설정되어 있습니다' }, { status: 409 })
  }

  // 비밀번호 업데이트 (service role)
  const { error: updateErr } = await admin.auth.admin.updateUserById(profile.id, { password })
  if (updateErr) {
    return NextResponse.json({ error: '비밀번호 설정 실패: ' + updateErr.message }, { status: 500 })
  }

  // 플래그 해제
  await admin.from('users').update({ needs_password_reset: false }).eq('id', profile.id)

  return NextResponse.json({ ok: true })
}
