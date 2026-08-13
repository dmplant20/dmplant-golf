import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// 네이티브(Capacitor) 기기 푸시 토큰 등록/해제 — FCM/APNs.
// device_push_tokens 테이블(unique user_id,token). 쿠키 세션 인증.

async function makeSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
      },
    }
  )
}

// POST — 토큰 등록/갱신
export async function POST(req: NextRequest) {
  const supabase = await makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { platform, token, app_version } = await req.json()
  if (!token || (platform !== 'android' && platform !== 'ios')) {
    return NextResponse.json({ error: 'Invalid token/platform' }, { status: 400 })
  }

  const { error } = await supabase.from('device_push_tokens').upsert(
    { user_id: user.id, platform, token, app_version: app_version ?? null, updated_at: new Date().toISOString() },
    { onConflict: 'user_id,token' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}

// DELETE — 로그아웃/토큰 교체 시 정리
export async function DELETE(req: NextRequest) {
  const supabase = await makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { token } = await req.json()
  if (token) {
    await supabase.from('device_push_tokens').delete().eq('user_id', user.id).eq('token', token)
  }
  return NextResponse.json({ ok: true })
}
