// 첫 로그인 후 강제 비밀번호 설정
// 인증된 사용자만 자기 자신의 비밀번호를 설정할 수 있음
// 성공 시 users.password_set=true 로 마킹 → 이후 팝업 안 뜸
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

async function makeAuthClient() {
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
  return supabase
}

function makeService() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!k) return null
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, k, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(req: NextRequest) {
  const authClient = await makeAuthClient()
  const { data: { user }, error: userError } = await authClient.auth.getUser()
  if (userError || !user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  let body: unknown
  try { body = await req.json() } catch {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 })
  }
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    return NextResponse.json({ error: '잘못된 요청입니다' }, { status: 400 })
  }
  const { password, nonce } = body as Record<string, unknown>
  if (typeof password !== 'string' || password.length < 8 || password.length > 72 ||
      (nonce !== undefined && (typeof nonce !== 'string' || !nonce || nonce.length > 512))) {
    return NextResponse.json({ error: '비밀번호는 8~72자여야 하며 인증코드는 문자열이어야 합니다' }, { status: 400 })
  }

  // Verify configuration before changing the password: avoid hidden partial success.
  const service = makeService()
  if (!service) return NextResponse.json({ error: '서버 설정을 확인해 주세요' }, { status: 503 })

  // User-scoped update preserves Supabase password policy and reauthentication.
  // Never use admin.updateUserById here: a session is not an admin override.
  const { data: updated, error: pwErr } = await authClient.auth.updateUser({
    password,
    ...(typeof nonce === 'string' ? { nonce } : {}),
  })
  if (pwErr) {
    return NextResponse.json({
      error: pwErr.code === 'reauthentication_needed'
        ? '본인 확인이 필요합니다. 비밀번호 재설정을 이용해 주세요.'
        : '비밀번호 변경에 실패했습니다. 비밀번호 정책 또는 본인 확인을 확인해 주세요.',
      code: pwErr.code ?? 'password_update_failed',
    }, { status: 400 })
  }
  if (updated.user?.id !== user.id) {
    return NextResponse.json({ error: '변경 결과를 확인할 수 없습니다', password_changed: true }, { status: 500 })
  }

  // Admin capability is restricted to a profile flag AFTER successful own update.
  const { data: profile, error: flagErr } = await service.from('users')
    .update({ password_set: true }).eq('id', user.id).select('id').maybeSingle()
  if (flagErr || profile?.id !== user.id) {
    return NextResponse.json({
      error: '비밀번호는 변경됐지만 프로필 상태 갱신에 실패했습니다.',
      password_changed: true,
    }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
