import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { sendPushWithLogging, initVapid as initVapidShared } from '@/lib/push-server'

// ── VAPID 초기화 (공통 헬퍼 위임) ────────────────────────────────────────
const initVapid = initVapidShared

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

// ── 푸시 발송 헬퍼 (공통 모듈 사용) ──────────────────────────────────────
async function sendPushToUsers(
  service: ReturnType<typeof makeService>,
  userIds: string[],
  payload: { title: string; body: string; url: string },
  clubId?: string,
): Promise<number> {
  if (!service || !userIds.length) return 0
  const r = await sendPushWithLogging({
    service: service as any,
    userIds,
    type: 'meeting',
    title: payload.title,
    body: payload.body,
    url: payload.url,
    clubId: clubId ?? null,
  })
  return r.sent
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
    .select('club_id, week_of_month, day_of_week, start_time, venue, is_active, created_by, clubs(id, name)')
    .eq('is_active', true)

  if (patternErr || !patterns?.length) {
    return NextResponse.json({ ok: true, sent: 0, reason: patternErr?.message ?? 'no patterns' })
  }

  let totalSent = 0
  let totalAnnouncements = 0
  const breakdown: any[] = []
  const announcementsCreated: any[] = []

  // 한국어 날짜 포맷 헬퍼 (서버용 — 가볍게 직접 작성)
  const KO_WEEKDAYS = ['일','월','화','수','목','금','토']
  function fmtDateKo(d: Date): string {
    return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${KO_WEEKDAYS[d.getUTCDay()]})`
  }
  function fmtTimeKo(t?: string | null): string {
    if (!t) return ''
    const [hStr, mStr] = t.split(':')
    const h = parseInt(hStr); const m = parseInt(mStr)
    const ap = h < 12 ? '오전' : '오후'
    const hh = h % 12 || 12
    return ` ${ap} ${hh}:${String(m).padStart(2, '0')}`
  }

  for (const pattern of patterns) {
    const weekOfMonth = pattern.week_of_month ?? 1
    const dayOfWeek   = pattern.day_of_week ?? 0
    const clubRec = Array.isArray(pattern.clubs) ? pattern.clubs[0] : pattern.clubs
    const clubName = clubRec?.name ?? String(pattern.club_id).slice(0, 8)

    // ── ⓐ 자동 공지 등록: D-14 이내 다음 모임 1개를 검사 ──────────────────
    // 회장/총무가 페이지에 안 들어와도 cron 이 직접 announcements INSERT.
    // 멱등 — 같은 [정기모임-YYYY-M] 키 공지가 이미 있으면 스킵.
    try {
      // 이번 달 + 다음 달 후보 중 D <= 14 인 첫 모임 찾기
      let nextMeeting: { date: Date; year: number; month: number } | null = null
      for (let offset = 0; offset <= 1; offset++) {
        let y = year, m = month + offset
        if (m > 12) { m = 1; y++ }
        const md = getNthWeekdayDate(y, m, weekOfMonth, dayOfWeek)
        if (!md) continue
        const diffDays = Math.round((md.getTime() - todayUTC) / 86400000)
        if (diffDays < 0) continue        // 이미 지난 모임
        if (diffDays > 14) continue       // 아직 14일보다 멀음
        // override 취소 검사
        const { data: ov0 } = await service
          .from('meeting_overrides')
          .select('status').eq('club_id', pattern.club_id).eq('year', y).eq('month', m).maybeSingle()
        if (ov0?.status === 'cancelled') continue
        nextMeeting = { date: md, year: y, month: m }
        break
      }

      if (nextMeeting) {
        const key = `[정기모임-${nextMeeting.year}-${nextMeeting.month}]`
        // 같은 키 공지 이미 있는지 확인
        const { data: existing } = await service
          .from('announcements')
          .select('id').eq('club_id', pattern.club_id)
          .ilike('title', `${key}%`).maybeSingle()
        if (!existing) {
          const ds   = fmtDateKo(nextMeeting.date)
          const ts   = fmtTimeKo(pattern.start_time)
          const dsEn = nextMeeting.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', weekday: 'short' })
          const monthEn = nextMeeting.date.toLocaleDateString('en-US', { month: 'long' })
          // 모임 다음날 자정 만료 — announcements.expires_at 컬럼이 있을 때만 사용
          const expiresAt = new Date(nextMeeting.date.getTime() + 86400000).toISOString()

          // 누가 작성자? — 패턴 생성자(created_by) 사용. 없으면 클럽 회장/총무 fallback.
          let authorId: string | null = (pattern as any).created_by ?? null
          if (!authorId) {
            const { data: officer } = await service
              .from('club_memberships').select('user_id')
              .eq('club_id', pattern.club_id)
              .eq('status', 'approved')
              .in('role', ['president', 'secretary']).limit(1).maybeSingle()
            authorId = officer?.user_id ?? null
          }

          const payload: any = {
            club_id:    pattern.club_id,
            title:      `${key} ${nextMeeting.year}년 ${nextMeeting.month}월 정기모임 안내`,
            title_en:   `${key} ${monthEn} Regular Meeting`,
            content:    `${nextMeeting.year}년 ${nextMeeting.month}월 정기모임 일정 안내드립니다.\n\n📅 ${ds}${ts}\n📍 ${pattern.venue ?? '미정'}\n\n정기모임 메뉴에서 참석/불참 여부를 등록해 주세요.`,
            content_en: `Regular meeting on ${dsEn}${ts}. Please RSVP via the Meetings menu.`,
            author_id:  authorId,
            is_meeting: true,
            expires_at: expiresAt,
          }
          const { error: insErr } = await service.from('announcements').insert(payload)
          if (insErr) {
            // is_meeting / expires_at 컬럼이 없는 환경 → 그것들 제거 후 재시도
            const fallback: any = {
              club_id: pattern.club_id, title: payload.title, title_en: payload.title_en,
              content: payload.content, content_en: payload.content_en, author_id: authorId,
            }
            const { error: insErr2 } = await service.from('announcements').insert(fallback)
            if (insErr2) {
              console.error(`[auto-notice] ${clubName} insert 실패:`, insErr2.message)
            } else {
              totalAnnouncements++
              announcementsCreated.push({ club: clubName, key, fallback: true })
            }
          } else {
            totalAnnouncements++
            announcementsCreated.push({ club: clubName, key })
          }
        }
      }
    } catch (e: any) {
      console.error(`[auto-notice] ${clubName} 예외:`, e?.message)
    }

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
        }, pattern.club_id)
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
    announcementsCreated: totalAnnouncements,
    announcementsDetail: announcementsCreated,
  })
}
