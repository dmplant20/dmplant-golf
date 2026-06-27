// 첫 로그인 후 강제 비밀번호 설정
// 인증된 사용자만 자기 자신의 비밀번호를 설정할 수 있음
// 성공 시 users.password_set=true 로 마킹 → 이후 팝업 안 뜸
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

async function getAuthUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function makeService() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!k) return null
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, k, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const { password } = await req.json() as { password?: string }
  if (!password || password.length < 8) {
    return NextResponse.json({ error: '비밀번호는 8자 이상이어야 합니다' }, { status: 400 })
  }
  if (password.length > 72) {
    return NextResponse.json({ error: '비밀번호는 72자 이하여야 합니다' }, { status: 400 })
  }

  const service = makeService()
  if (!service) return NextResponse.json({ error: 'service role 미설정' }, { status: 500 })

  // 1. auth.users 비밀번호 갱신
  const { error: pwErr } = await service.auth.admin.updateUserById(user.id, { password })
  if (pwErr) {
    console.error('[set-password]', pwErr)
    return NextResponse.json({ error: pwErr.message }, { status: 500 })
  }

  // 2. public.users.password_set = true
  const { error: flagErr } = await service.from('users')
    .update({ password_set: true }).eq('id', user.id)
  if (flagErr) {
    console.error('[set-password flag]', flagErr)
    // 비밀번호는 이미 변경됐지만 flag 갱신 실패 — 다음 페이지 로드 시 재시도 필요
    return NextResponse.json({ error: flagErr.message, password_changed: true }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}
