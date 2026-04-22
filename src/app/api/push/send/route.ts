import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

// VAPID 설정
webpush.setVapidDetails(
  process.env.VAPID_EMAIL ?? 'mailto:admin@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '',
  process.env.VAPID_PRIVATE_KEY ?? ''
)

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
  // 1. 인증 확인
  const anonSupa = await makeAnonSupabase()
  const { data: { user } } = await anonSupa.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // 2. 요청 파싱
  const { club_id, title, body, url = '/' } = await req.json()
  if (!club_id || !title) return NextResponse.json({ error: 'club_id, title required' }, { status: 400 })

  // 3. 발신자가 해당 클럽 임원인지 확인
  const { data: membership } = await anonSupa.from('club_memberships')
    .select('role').eq('club_id', club_id).eq('user_id', user.id).eq('status', 'approved').maybeSingle()
  const OFFICER_ROLES = ['president','vice_president','secretary','auditor','advisor','officer']
  if (!membership || !OFFICER_ROLES.includes(membership.role)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // 4. 클럽 멤버 전체 user_id 조회
  const { data: members } = await anonSupa.from('club_memberships')
    .select('user_id').eq('club_id', club_id).eq('status', 'approved')
  const memberIds = (members ?? []).map((m: any) => m.user_id)
  if (!memberIds.length) return NextResponse.json({ sent: 0 })

  // 5. service_role로 push_subscriptions 조회 (RLS bypass)
  const serviceSupa = makeServiceSupabase()
  let subscriptions: any[] = []
  if (serviceSupa) {
    const { data } = await serviceSupa.from('push_subscriptions')
      .select('endpoint, p256dh, auth').in('user_id', memberIds)
    subscriptions = data ?? []
  } else {
    // SUPABASE_SERVICE_ROLE_KEY 없음
    // Vercel 환경변수에 추가하면 전체 발송 가능해짐
    console.warn('SUPABASE_SERVICE_ROLE_KEY not set')
    return NextResponse.json({ error: 'SUPABASE_SERVICE_ROLE_KEY not configured', sent: 0 }, { status: 500 })
  }

  if (!subscriptions.length) return NextResponse.json({ sent: 0 })

  // 6. 푸시 발송
  const payload = JSON.stringify({ title, body: body ?? '', url })
  let sent = 0
  const expired: string[] = []

  await Promise.allSettled(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 86400 }
        )
        sent++
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) {
          expired.push(sub.endpoint)
        } else {
          console.error('push error:', err.statusCode, err.message)
        }
      }
    })
  )

  // 7. 만료된 구독 정리
  if (expired.length && serviceSupa) {
    await serviceSupa.from('push_subscriptions').delete().in('endpoint', expired)
  }

  return NextResponse.json({ sent, total: subscriptions.length })
}
