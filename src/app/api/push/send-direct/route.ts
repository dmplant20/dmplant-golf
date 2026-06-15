// 특정 user_id 들에게 푸시 발송 — 채팅 메시지 알림용
// (club 단위 발송은 /api/push/send 사용)
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { sendPushWithLogging } from '@/lib/push-server'

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

  const result = await sendPushWithLogging({
    service, userIds: targets,
    type: 'chat',
    title, body: body ?? '', url,
    sentBy: user.id,
  })
  return NextResponse.json({ sent: result.sent, total: result.total, failed: result.failed, skipped: result.skipped })
}
