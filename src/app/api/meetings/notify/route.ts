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

  // 다단계 D-N 알림: 10, 7, 3, 1, 0(당일)
  // 모임 D-Day 까지 강한 체인으로 여러 번 알림 발송
  const DAY_OFFSETS = [10, 7, 3, 1, 0] as const
  const todayUTC = Date.UTC(year, month - 1, day)

  // ② 모든 클럽의 정기모임 패턴 조회 (테이블 이름: recurring_meetings)
  const { data: patterns, error: patternErr } = await service
    .from('recurring_meetings')
    .select('club_id, week_of_month, day_of_week, start_time, venue, is_active, clubs(id, name)')
    .eq('is_active', true)

  if (patternErr || !patterns?.length) {
    return NextResponse.json({ ok: true, sent: 0, reason: patternErr?.message ?? 'no patterns' })
  }

  let totalSent = 0
  const breakdown: any[] = []

  for (const pattern of patterns) {
    const weekOfMonth = pattern.week_of_month ?? 1
    const dayOfWeek   = pattern.day_of_week ?? 0
    const clubRec = Array.isArray(pattern.clubs) ? pattern.clubs[0] : pattern.clubs
    const clubName = clubRec?.name ?? String(pattern.club_id).slice(0, 8)

    // 각 D-N 단계마다 해당 일자에 모임이 있는지 검사
    for (const offset of DAY_OFFSETS) {
      const tgt = new Date(todayUTC + offset * 86400000)
      const tgtY = tgt.getUTCFullYear()
      const tgtM = tgt.getUTCMonth() + 1
      const tgtD = tgt.getUTCDate()

      // 해당 월의 N째 요일이 tgt 와 일치?
      const meetingDate = getNthWeekdayDate(tgtY, tgtM, weekOfMonth, dayOfWeek)
      if (!meetingDate) continue
      if (
        meetingDate.getUTCFullYear() !== tgtY ||
        meetingDate.getUTCMonth() + 1 !== tgtM ||
        meetingDate.getUTCDate() !== tgtD
      ) continue

      // 모임 override 확인 — 취소된 모임은 알림 보내지 않음
      const { data: ov } = await service
        .from('meeting_overrides')
        .select('status, override_date')
        .eq('club_id', pattern.club_id).eq('year', tgtY).eq('month', tgtM).maybeSingle()
      if (ov?.status === 'cancelled') continue

      // ③ 클럽 승인 멤버 + 아직 미응답인 사람만 발송
      const { data: memberships } = await service
        .from('club_memberships')
        .select('user_id')
        .eq('club_id', pattern.club_id)
        .eq('status', 'approved')

      if (!memberships?.length) continue
      const allMemberIds = memberships.map((m: any) => m.user_id)

      const { data: responded } = await service
        .from('meeting_attendances')
        .select('user_id')
        .eq('club_id', pattern.club_id)
        .eq('year', tgtY)
        .eq('month', tgtM)

      const respondedIds = new Set((responded ?? []).map((r: any) => r.user_id))
      // D-0(당일) 은 응답한 사람도 포함 — 모임 시작 리마인더
      const targetIds = offset === 0
        ? allMemberIds
        : allMemberIds.filter((id: string) => !respondedIds.has(id))

      if (!targetIds.length) continue

      // 메시지 문구는 D-N 단계별로 다르게 — 더 긴급하게
      const titleByOffset: Record<number, string> = {
        10: `📅 [${clubName}] 정기모임 D-10`,
         7: `📅 [${clubName}] 정기모임 D-7 — 일주일 남음`,
         3: `⚠️ [${clubName}] 정기모임 D-3 — 3일 남음`,
         1: `🔔 [${clubName}] 정기모임 내일입니다!`,
         0: `⛳ [${clubName}] 오늘 정기모임 ${pattern.start_time?.slice(0,5) ?? ''} ${pattern.venue ?? ''}`.trim(),
      }
      const bodyByOffset: Record<number, string> = {
        10: '10일 후 정기모임이 있습니다. 참석 여부를 알려주세요!',
         7: '일주일 후 정기모임입니다. 아직 응답하지 않으셨습니다.',
         3: '3일 후 정기모임입니다. 꼭 참석 여부를 알려주세요!',
         1: '내일 정기모임입니다. 응답이 누락된 회원분만 알림을 받습니다.',
         0: pattern.venue ? `${pattern.venue} 에서 ${pattern.start_time?.slice(0,5) ?? ''} 시작!` : '오늘 정기모임이 있습니다!',
      }

      if (vapidOk) {
        const sent = await sendPushToUsers(service, targetIds, {
          title: titleByOffset[offset],
          body: bodyByOffset[offset],
          url: '/meetings',
        })
        totalSent += sent
        breakdown.push({ club: clubName, offset, sent, total: targetIds.length })
      }
    }
  }

  return NextResponse.json({
    ok: true,
    date: `${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`,
    totalSent,
    breakdown,
  })
}
