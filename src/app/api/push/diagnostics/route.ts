// 푸시 시스템 진단 — 회장/총무용
// 반환: 구독자 통계, 미구독자 명단, 최근 발송 로그
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { isSuperAdmin } from '@/lib/superAdmin'

async function makeAnon() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )
}

function makeService() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!k) return null
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, k, { auth: { persistSession: false } })
}

export async function GET(req: NextRequest) {
  const anon = await makeAnon()
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = makeService()
  if (!service) return NextResponse.json({ error: 'service role missing' }, { status: 500 })

  const url = new URL(req.url)
  const clubId = url.searchParams.get('club_id')
  if (!clubId) return NextResponse.json({ error: 'club_id required' }, { status: 400 })

  // 권한 검사
  if (!isSuperAdmin(user)) {
    const { data: mem } = await anon.from('club_memberships').select('role')
      .eq('club_id', clubId).eq('user_id', user.id).eq('status', 'approved').maybeSingle()
    if (!mem || !['president', 'secretary'].includes(mem.role)) {
      return NextResponse.json({ error: '회장/총무만 가능' }, { status: 403 })
    }
  }

  // 클럽 회원 + 구독 매핑
  // ⚠ users:user_id 명시 — club_memberships 는 users 참조 FK 가 2개 (user_id, withdrawn_by)
  const { data: members } = await service.from('club_memberships')
    .select('user_id, role, users:user_id(id, full_name, email, full_name_en)')
    .eq('club_id', clubId).eq('status', 'approved')

  const memberRows = (members ?? []).map((m: any) => ({
    user_id: m.user_id, role: m.role,
    full_name: m.users?.full_name, full_name_en: m.users?.full_name_en, email: m.users?.email,
  }))
  const memIds = memberRows.map(m => m.user_id)

  const { data: subs } = await service.from('push_subscriptions')
    .select('user_id, endpoint, created_at')
    .in('user_id', memIds)

  // user_id → 마지막 구독시각
  const subInfo = new Map<string, { count: number; latest: string | null }>()
  for (const s of (subs ?? [])) {
    const cur = subInfo.get(s.user_id) ?? { count: 0, latest: null }
    cur.count++
    if (!cur.latest || s.created_at > cur.latest) cur.latest = s.created_at
    subInfo.set(s.user_id, cur)
  }

  const enriched = memberRows.map(m => ({
    ...m,
    subscribed: subInfo.has(m.user_id),
    sub_count: subInfo.get(m.user_id)?.count ?? 0,
    sub_latest: subInfo.get(m.user_id)?.latest ?? null,
  }))

  // 최근 발송 로그 (해당 클럽)
  const { data: logs } = await service.from('notification_logs')
    .select('id, user_id, type, title, status, error_code, error_message, status_code, created_at')
    .eq('club_id', clubId)
    .order('created_at', { ascending: false })
    .limit(50)

  // 발송 통계 (최근 30일)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 86400000).toISOString()
  const { data: recentLogs } = await service.from('notification_logs')
    .select('status, error_code')
    .eq('club_id', clubId)
    .gte('created_at', thirtyDaysAgo)

  const stats = { total: 0, success: 0, failed: 0, skipped: 0, by_error: {} as Record<string, number> }
  for (const l of (recentLogs ?? [])) {
    stats.total++
    if (l.status === 'success') stats.success++
    else if (l.status === 'failed') stats.failed++
    else stats.skipped++
    if (l.error_code) stats.by_error[l.error_code] = (stats.by_error[l.error_code] ?? 0) + 1
  }

  // 환경변수 상태
  const env = {
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: Boolean(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY),
    VAPID_PRIVATE_KEY: Boolean(process.env.VAPID_PRIVATE_KEY),
    VAPID_EMAIL: process.env.VAPID_EMAIL ?? null,
    SUPABASE_SERVICE_ROLE_KEY: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
  }

  return NextResponse.json({
    members: enriched,
    summary: {
      total: enriched.length,
      subscribed: enriched.filter(m => m.subscribed).length,
      unsubscribed: enriched.filter(m => !m.subscribed).length,
    },
    recent_logs: logs ?? [],
    stats_30d: stats,
    env,
  })
}
