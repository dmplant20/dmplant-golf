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

// ── 날짜 유틸 ─────────────────────────────────────────────────────────────
/** Vietnam 현지 날짜 (UTC+7) */
function vietnamToday(): { month: number; day: number; year: number } {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000) // UTC+7 offset
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate() }
}

/** birth_date (YYYY-MM-DD)에서 MM-DD 추출 */
function mmdd(d: string) { return d.slice(5, 10) }  // "MM-DD"

/** 오늘로부터 daysAhead 후의 MM-DD 반환 */
function futureMmdd(baseYear: number, baseMonth: number, baseDay: number, daysAhead: number) {
  const d = new Date(Date.UTC(baseYear, baseMonth - 1, baseDay + daysAhead))
  const m = String(d.getUTCMonth() + 1).padStart(2, '0')
  const day = String(d.getUTCDate()).padStart(2, '0')
  return `${m}-${day}`
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
  // ① Vercel Cron 또는 수동 호출 인증
  const authHeader = req.headers.get('authorization')
  const cronSecret = process.env.CRON_SECRET
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const vapidOk = initVapid()
  const service = makeService()
  if (!service) return NextResponse.json({ error: 'Service role key missing' }, { status: 500 })

  const { year, month, day } = vietnamToday()
  const todayMmdd = `${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`

  // 7일 후 MM-DD (임원 사전 알림용)
  const advanceMmdd = futureMmdd(year, month, day, 7)

  // ② 생년월일이 있는 모든 승인된 멤버십 + 유저 정보 조회
  const { data: memberships } = await service
    .from('club_memberships')
    .select('club_id, user_id, role, users!inner(full_name, birth_date)')
    .eq('status', 'approved')
    .not('users.birth_date', 'is', null)

  if (!memberships?.length) return NextResponse.json({ processed: 0 })

  // ③ 클럽별로 그룹화
  const byClub: Record<string, { userId: string; role: string; name: string; birthDate: string }[]> = {}
  for (const m of memberships) {
    const u = Array.isArray(m.users) ? m.users[0] : m.users
    if (!u?.birth_date) continue
    if (!byClub[m.club_id]) byClub[m.club_id] = []
    byClub[m.club_id].push({
      userId: m.user_id,
      role: m.role,
      name: u.full_name,
      birthDate: u.birth_date,
    })
  }

  const OFFICER_ROLES = ['president', 'vice_president', 'secretary', 'auditor', 'advisor', 'officer']
  let totalSent = 0

  for (const [clubId, members] of Object.entries(byClub)) {
    // 전체 클럽 멤버 ID 목록
    const allIds    = members.map(m => m.userId)
    const officerIds = members.filter(m => OFFICER_ROLES.includes(m.role)).map(m => m.userId)

    for (const member of members) {
      const bday = mmdd(member.birthDate)

      // ─ 오늘 생일 → 전체 알림 ─────────────────────────────────────────
      if (bday === todayMmdd) {
        // 중복 방지: 올해 이미 보냈으면 skip
        const { data: dup } = await service
          .from('birthday_notifications')
          .select('id').eq('user_id', member.userId).eq('club_id', clubId)
          .eq('year', year).eq('type', 'today').maybeSingle()
        if (dup) continue

        if (vapidOk) {
          const sent = await sendPushToUsers(service, allIds, {
            title: `🎂 ${member.name} 회원님의 생일입니다!`,
            body: '오늘 생일을 맞으신 회원님께 축하 인사를 전해드려요 🎉',
            url: '/announcement',
          })
          totalSent += sent
        }

        // 기록 저장 (중복 방지 — upsert ignoreDuplicates)
        await service.from('birthday_notifications').upsert(
          { user_id: member.userId, club_id: clubId, year, type: 'today' },
          { onConflict: 'user_id,club_id,year,type', ignoreDuplicates: true }
        )
      }

      // ─ 7일 후 생일 → 임원 사전 알림 ─────────────────────────────────
      if (bday === advanceMmdd) {
        const { data: dup } = await service
          .from('birthday_notifications')
          .select('id').eq('user_id', member.userId).eq('club_id', clubId)
          .eq('year', year).eq('type', 'advance').maybeSingle()
        if (dup) continue

        if (vapidOk && officerIds.length) {
          const sent = await sendPushToUsers(service, officerIds, {
            title: `🎈 ${member.name} 회원 생일 D-7`,
            body: `7일 후인 ${String(month).padStart(2,'0')}/${String(day + 7).padStart(2,'0')}이 생일입니다. 미리 준비해 드세요!`,
            url: '/announcement',
          })
          totalSent += sent
        }

        await service.from('birthday_notifications').upsert(
          { user_id: member.userId, club_id: clubId, year, type: 'advance' },
          { onConflict: 'user_id,club_id,year,type', ignoreDuplicates: true }
        )
      }
    }
  }

  return NextResponse.json({ ok: true, date: `${year}-${todayMmdd}`, totalSent })
}
