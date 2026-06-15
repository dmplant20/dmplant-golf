import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { isSuperAdmin } from '@/lib/superAdmin'
import { sendPushWithLogging, initVapid } from '@/lib/push-server'

async function makeAnonSupabase() {
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

// service_role 클라이언트 — push_subscriptions 전체 조회용 (RLS bypass)
function makeServiceSupabase() {
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceKey) return null
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceKey
  )
}

export async function POST(req: NextRequest) {
  // VAPID 키 초기화 — 설정 안 됐으면 즉시 반환
  if (!initVapid()) {
    return NextResponse.json({ error: 'VAPID keys not configured in environment' }, { status: 500 })
  }

  // 1. 인증 확인
  const anonSupa = await makeAnonSupabase()
  const { data: { user } } = await anonSupa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. 요청 파싱
  const { club_id, title, body, url = '/' } = await req.json()
  if (!club_id || !title) return NextResponse.json({ error: 'club_id, title required' }, { status: 400 })

  // 3. 발신자가 해당 클럽 임원인지 또는 슈퍼관리자(개발자) 확인
  const { data: membership } = await anonSupa.from('club_memberships')
    .select('role').eq('club_id', club_id).eq('user_id', user.id).eq('status', 'approved').maybeSingle()
  const OFFICER_ROLES = ['president','vice_president','secretary','auditor','advisor','officer']
  const admin = isSuperAdmin(user)
  if (!admin && (!membership || !OFFICER_ROLES.includes(membership.role))) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 4. 클럽 멤버 전체 user_id 조회
  const { data: members } = await anonSupa.from('club_memberships')
    .select('user_id').eq('club_id', club_id).eq('status', 'approved')
  const memberIds = (members ?? []).map((m: any) => m.user_id)
  if (!memberIds.length) return NextResponse.json({ sent: 0 })

  const serviceSupa = makeServiceSupabase()
  if (!serviceSupa) return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured', sent: 0 }, { status: 500 })

  // 5~7. 공통 헬퍼 — 로깅 + 사용자 설정 체크 + 만료 정리
  const result = await sendPushWithLogging({
    service: serviceSupa,
    userIds: memberIds,
    type: 'announcement',
    title, body: body ?? '', url,
    clubId: club_id,
    sentBy: user.id,
  })
  return NextResponse.json({ sent: result.sent, total: result.total, failed: result.failed, skipped: result.skipped })
}
