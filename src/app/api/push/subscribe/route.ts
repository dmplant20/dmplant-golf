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
        setAll: (list) => { list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)) },
      },
    }
  )
}

// GET /api/push/subscribe — 알림받기 영속 상태 조회 (진실의 원천)
//   opted_in: 사용자가 명시적으로 알림받기를 켰는가 (user_notification_preferences.push_opt_in)
//   subscribed: 현재 서버에 저장된 구독 endpoint 가 하나라도 있는가
// 토글 표시는 opted_in 기준. 로컬 구독(getSubscription)이 SW 재등록으로 사라져도 흔들리지 않음.
export async function GET() {
  const supabase = await makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: pref }, { count }] = await Promise.all([
    supabase.from('user_notification_preferences').select('push_opt_in').eq('user_id', user.id).maybeSingle(),
    supabase.from('push_subscriptions').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
  ])
  return NextResponse.json({
    opted_in: pref?.push_opt_in ?? false,
    subscribed: (count ?? 0) > 0,
  })
}

// POST /api/push/subscribe — 구독 저장 + 알림받기 opt-in=true (영속)
export async function POST(req: NextRequest) {
  const supabase = await makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json()
  const { endpoint, keys } = body
  if (!endpoint || !keys?.p256dh || !keys?.auth) {
    return NextResponse.json({ error: 'Invalid subscription' }, { status: 400 })
  }

  const { error } = await supabase.from('push_subscriptions').upsert(
    { user_id: user.id, endpoint, p256dh: keys.p256dh, auth: keys.auth },
    { onConflict: 'user_id,endpoint' }
  )
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // 영속 opt-in 플래그 ON — 이후 SW 재등록으로 로컬 구독이 사라져도 상태 유지
  await supabase.from('user_notification_preferences').upsert(
    { user_id: user.id, push_opt_in: true, updated_at: new Date().toISOString() },
    { onConflict: 'user_id' }
  )

  return NextResponse.json({ ok: true })
}

// DELETE /api/push/subscribe — 구독 해제
//   body.all === true (사용자가 "알림 해지") → 이 사용자의 모든 구독 삭제 + opt-in=false
//   endpoint 지정 → 해당 endpoint 만 삭제 (opt-in 은 유지)
export async function DELETE(req: NextRequest) {
  const supabase = await makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await req.json().catch(() => ({} as { endpoint?: string; all?: boolean }))
  const { endpoint, all } = body

  if (all) {
    // 사용자 명시적 해지 — 전체 구독 제거 + 영속 opt-out. 이후 자동재구독이 되살리지 않음.
    await supabase.from('push_subscriptions').delete().eq('user_id', user.id)
    await supabase.from('user_notification_preferences').upsert(
      { user_id: user.id, push_opt_in: false, updated_at: new Date().toISOString() },
      { onConflict: 'user_id' }
    )
  } else if (endpoint) {
    // stale endpoint 정리 등 — opt-in 은 건드리지 않음
    await supabase.from('push_subscriptions').delete().eq('user_id', user.id).eq('endpoint', endpoint)
  }

  return NextResponse.json({ ok: true })
}
