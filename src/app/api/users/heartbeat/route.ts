// 본인 last_seen_at 갱신 — 클라이언트가 60초마다 호출
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

export async function POST(_req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = makeService()
  if (!service) return NextResponse.json({ error: 'service role 미설정' }, { status: 500 })

  const { error } = await service.from('users')
    .update({ last_seen_at: new Date().toISOString() })
    .eq('id', user.id)

  if (error) {
    // 컬럼 없으면 조용히 무시 (마이그레이션 전 상태)
    if (error.message?.includes('column') || error.code === 'PGRST204' || error.code === '42703') {
      return NextResponse.json({ ok: false, schema_missing: true })
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  return NextResponse.json({ ok: true })
}
