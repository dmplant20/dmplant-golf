// 관리자 테스트 발송 — 특정 user_id 또는 club_id 전체에게 푸시 발송
// 회장/총무/슈퍼관리자만 가능. 결과 상세 (성공/실패/이유) 즉시 반환.
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { sendPushWithLogging } from '@/lib/push-server'
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

export async function POST(req: NextRequest) {
  const anon = await makeAnon()
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const service = makeService()
  if (!service) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured' }, { status: 500 })

  const body = await req.json() as {
    mode: 'self' | 'user' | 'club_all' | 'unsubscribed'
    club_id?: string
    target_user_id?: string
    title?: string
    body?: string
  }

  const title = body.title ?? '🔔 IS Golf 알림 테스트'
  const text  = body.body ?? `테스트 발송 — ${new Date().toLocaleString('ko-KR')}`

  // 권한 검사
  const admin = isSuperAdmin(user)
  let targetUserIds: string[] = []

  if (body.mode === 'self') {
    // 본인에게만 — 누구나 가능
    targetUserIds = [user.id]
  } else {
    if (!body.club_id) return NextResponse.json({ error: 'club_id required for non-self modes' }, { status: 400 })

    // 회장/총무/슈퍼관리자만 다른 회원에게 발송 가능
    if (!admin) {
      const { data: mem } = await anon.from('club_memberships').select('role')
        .eq('club_id', body.club_id).eq('user_id', user.id).eq('status','approved').maybeSingle()
      if (!mem || !['president','secretary'].includes(mem.role)) {
        return NextResponse.json({ error: '회장/총무만 가능' }, { status: 403 })
      }
    }

    if (body.mode === 'user') {
      if (!body.target_user_id) return NextResponse.json({ error: 'target_user_id required' }, { status: 400 })
      targetUserIds = [body.target_user_id]
    } else if (body.mode === 'club_all') {
      const { data: members } = await service.from('club_memberships').select('user_id')
        .eq('club_id', body.club_id).eq('status', 'approved')
      targetUserIds = (members ?? []).map((m: any) => m.user_id)
    } else if (body.mode === 'unsubscribed') {
      // 미구독자 명단 — 모두 'no_token' 으로 skipped 로깅됨
      const { data: members } = await service.from('club_memberships').select('user_id')
        .eq('club_id', body.club_id).eq('status', 'approved')
      const memIds = (members ?? []).map((m: any) => m.user_id)
      const { data: subs } = await service.from('push_subscriptions').select('user_id').in('user_id', memIds)
      const subscribedSet = new Set((subs ?? []).map((s: any) => s.user_id))
      targetUserIds = memIds.filter(id => !subscribedSet.has(id))
    } else {
      return NextResponse.json({ error: '잘못된 mode' }, { status: 400 })
    }
  }

  if (targetUserIds.length === 0) {
    return NextResponse.json({ ok: true, sent: 0, total: 0, details: [], note: '대상 없음' })
  }

  // 관리자 테스트는 사용자 admin_test=false 설정 존중 (단, mode='self' 는 본인이므로 무시)
  const skipPref = body.mode === 'self'

  const result = await sendPushWithLogging({
    service,
    userIds: targetUserIds,
    type: 'admin_test',
    title,
    body: text,
    url: '/',
    clubId: body.club_id ?? null,
    sentBy: user.id,
    skipPreferenceCheck: skipPref,
  })

  // 사용자 이름 매핑 (UI 표시용)
  const { data: nameRows } = await service.from('users').select('id, full_name, email').in('id', targetUserIds)
  const nameMap = new Map((nameRows ?? []).map((u: any) => [u.id, { name: u.full_name, email: u.email }]))

  return NextResponse.json({
    ok: true,
    ...result,
    details: result.details.map(d => ({
      ...d,
      name: nameMap.get(d.user_id)?.name ?? '?',
      email: nameMap.get(d.user_id)?.email ?? '?',
    })),
  })
}
