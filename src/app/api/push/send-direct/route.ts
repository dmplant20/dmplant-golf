// 특정 user_id 들에게 푸시 발송 — 채팅 메시지 알림용
// (club 단위 발송은 /api/push/send 사용)
import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function initVapid(): boolean {
  const pub  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const mail = process.env.VAPID_EMAIL ?? 'mailto:admin@example.com'
  if (pub && priv) { webpush.setVapidDetails(mail, pub, priv); return true }
  return false
}

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
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, k)
}

export async function POST(req: NextRequest) {
  if (!initVapid()) {
    return NextResponse.json({ error: 'VAPID keys not configured' }, { status: 500 })
  }
  const anon = await makeAnon()
  const { data: { user } } = await anon.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { user_ids, title, body, url = '/chat' } = await req.json() as
    { user_ids: string[]; title: string; body?: string; url?: string }
  if (!Array.isArray(user_ids) || user_ids.length === 0 || !title) {
    return NextResponse.json({ error: 'user_ids, title required' }, { status: 400 })
  }

  // 발신자 본인은 자동 제외
  const targets = user_ids.filter(id => id && id !== user.id)
  if (!targets.length) return NextResponse.json({ sent: 0 })

  const service = makeService()
  if (!service) return NextResponse.json({ error: 'service role not configured' }, { status: 500 })

  const { data: subs } = await service.from('push_subscriptions')
    .select('endpoint, p256dh, auth').in('user_id', targets)
  if (!subs?.length) return NextResponse.json({ sent: 0 })

  const payload = JSON.stringify({ title, body: body ?? '', url })
  let sent = 0
  const expired: string[] = []

  await Promise.allSettled(
    subs.map(async (sub: any) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 86400 }
        )
        sent++
      } catch (err: any) {
        if (err.statusCode === 410 || err.statusCode === 404) expired.push(sub.endpoint)
        else console.error('push-direct error:', err.statusCode, err.message)
      }
    })
  )

  if (expired.length) {
    await service.from('push_subscriptions').delete().in('endpoint', expired)
  }
  return NextResponse.json({ sent, total: subs.length })
}
