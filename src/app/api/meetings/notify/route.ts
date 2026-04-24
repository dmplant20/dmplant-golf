import { NextRequest, NextResponse } from 'next/server'
import webpush from 'web-push'
import { createClient as createServiceClient } from '@supabase/supabase-js'

// ── VAPID 초기화 ──────────────────────────────────────────────────────────
function initVapid() {
  const pub  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const mail = process.env.VAPID_EMAIL ?? 'mailto:admin@example.com'
  if (pub && priv) { webpush.setVapidDetails(mail, pub, priv); return true }
  return false
}

function makeService() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!key) return null
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key)
}

/** Vietnam 현지 날짜 (UTC+7) */
function vietnamToday(): { year: number; month: number; day: number } {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000)
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate() }
}

/** week_of_month (1-5) + day_of_week (0=Sun) → UTC Date */
function getNthWeekdayDate(
  year: number,
  month: number,
  week: number,
  dow: number
): Date | null {
  const first = new Date(Date.UTC(year, month - 1, 1))
  let diff = dow - first.getUTCDay()
  if (diff < 0) diff += 7
  const day = 1 + diff + (week - 1) * 7
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day > daysInMonth) return null
  return new Date(Date.UTC(year, month - 1, day))
}

// ── 푸시 발송 헬퍼 ────────────────────────────────────────────────────────
async function sendPushToUsers(
  service: ReturnType<typeof makeService>,
  userIds: string[],
  payload: { title: string; body: string; url: string }
) {
  if (!service || !userIds.length) return 0
  const { data: subs } = await service
    .from('push_subscriptions')
    .select('endpoint,p256dh,auth')
    .in('user_id', userIds)
  if (!subs?.length) return 0

  const raw = JSON.stringify(payload)
  let sent = 0
  const expired: string[] = []

  await Promise.allSettled(subs.map(async (s: any) => {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        raw,
        { TTL: 86400 }
      )
      sent++
    } catch (err: any) {
      if (err.statusCode === 410 || err.statusCode === 404) expired.push(s.endpoint)
    }
  }))

  if (expired.length) {
    await service.from('push_subscriptions').delete().in('endpoint', expired)
  }
  return sent
}

// ── 메인 핸들러 ───────────────────────────────────────────────────────────
export async function GET(req: NextRequest) {
  // ① Vercel Cron 인증
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const vapidOk = initVapid()
  const service = makeService()
  if (!service) return NextResponse.json({ error: 'Service role key missing' }, { status: 500 })

  const { year, month, day } = vietnamToday()

  // Target date = exactly 10 days from today (VN time)
  const target = new Date(Date.UTC(year, month - 1, day + 10))
  const targetYear  = target.getUTCFullYear()
  const targetMonth = target.getUTCMonth() + 1
  const targetDay   = target.getUTCDate()

  // ② 모든 클럽의 meeting_patterns 조회
  const { data: patterns, error: patternErr } = await service
    .from('meeting_patterns')
    .select('club_id, week_of_month, day_of_week, start_time, venue, clubs(id, name)')

  if (patternErr || !patterns?.length) {
    return NextResponse.json({ ok: true, sent: 0, reason: 'no patterns' })
  }

  let totalSent = 0

  for (const pattern of patterns) {
    const weekOfMonth = pattern.week_of_month ?? 1
    const dayOfWeek   = pattern.day_of_week ?? 0

    // Calculate the meeting date for the target month
    const meetingDate = getNthWeekdayDate(targetYear, targetMonth, weekOfMonth, dayOfWeek)
    if (!meetingDate) continue

    // Check if the meeting date is exactly 10 days from today
    if (
      meetingDate.getUTCFullYear() !== targetYear ||
      meetingDate.getUTCMonth() + 1 !== targetMonth ||
      meetingDate.getUTCDate() !== targetDay
    ) {
      continue
    }

    // ③ Approved members of this club who haven't responded
    const { data: memberships } = await service
      .from('club_memberships')
      .select('user_id')
      .eq('club_id', pattern.club_id)
      .eq('status', 'approved')

    if (!memberships?.length) continue

    const allMemberIds = memberships.map((m: any) => m.user_id)

    // Check who already responded
    const { data: responded } = await service
      .from('meeting_attendances')
      .select('user_id')
      .eq('club_id', pattern.club_id)
      .eq('year', targetYear)
      .eq('month', targetMonth)

    const respondedIds = new Set((responded ?? []).map((r: any) => r.user_id))
    const pendingIds = allMemberIds.filter((id: string) => !respondedIds.has(id))

    if (!pendingIds.length) continue

    const clubRec = Array.isArray(pattern.clubs) ? pattern.clubs[0] : pattern.clubs
    const clubName = clubRec?.name ?? pattern.club_id

    if (vapidOk) {
      const sent = await sendPushToUsers(service, pendingIds, {
        title: `📅 [${clubName}] 정기모임 D-10`,
        body: '10일 후 정기모임이 있습니다. 참석 여부를 알려주세요!',
        url: '/meetings',
      })
      totalSent += sent
    }
  }

  return NextResponse.json({ ok: true, date: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`, totalSent })
}
