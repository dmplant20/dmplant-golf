// 즉시 백필 — cron 이 내일 8시에 돌기 전에 누락된 D-14 이내 정기모임 공지를 자동 INSERT
// 멱등 — 같은 [정기모임-YYYY-M] 키 공지가 이미 있으면 스킵
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

function vietnamToday() {
  const now = new Date(Date.now() + 7 * 60 * 60 * 1000)
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate() }
}
function getNthWeekdayDate(year, month, week, dow) {
  const first = new Date(Date.UTC(year, month - 1, 1))
  let diff = dow - first.getUTCDay()
  if (diff < 0) diff += 7
  const day = 1 + diff + (week - 1) * 7
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day > daysInMonth) return null
  return new Date(Date.UTC(year, month - 1, day))
}
const KO_WEEKDAYS = ['일','월','화','수','목','금','토']
function fmtDateKo(d) { return `${d.getUTCMonth() + 1}월 ${d.getUTCDate()}일 (${KO_WEEKDAYS[d.getUTCDay()]})` }
function fmtTimeKo(t) {
  if (!t) return ''
  const [h, m] = t.split(':').map(Number)
  const ap = h < 12 ? '오전' : '오후'
  const hh = h % 12 || 12
  return ` ${ap} ${hh}:${String(m).padStart(2, '0')}`
}

const { year, month, day } = vietnamToday()
const todayUTC = Date.UTC(year, month - 1, day)
console.log(`▶ 오늘 (베트남): ${year}-${String(month).padStart(2,'0')}-${String(day).padStart(2,'0')}`)

const { data: patterns } = await a.from('recurring_meetings')
  .select('club_id, week_of_month, day_of_week, start_time, venue, is_active, created_by, clubs(name)')
  .eq('is_active', true)

console.log(`\n활성 패턴 ${patterns?.length ?? 0}개:`)
let created = 0
let skipped = 0

for (const p of patterns ?? []) {
  const clubName = p.clubs?.name ?? p.club_id.slice(0,8)
  // 이번 달 + 다음 달 후보
  let nextMeeting = null
  for (let offset = 0; offset <= 1; offset++) {
    let y = year, m = month + offset
    if (m > 12) { m = 1; y++ }
    const md = getNthWeekdayDate(y, m, p.week_of_month, p.day_of_week)
    if (!md) continue
    const diffDays = Math.round((md.getTime() - todayUTC) / 86400000)
    if (diffDays < 0 || diffDays > 14) continue
    const { data: ov0 } = await a.from('meeting_overrides').select('status')
      .eq('club_id', p.club_id).eq('year', y).eq('month', m).maybeSingle()
    if (ov0?.status === 'cancelled') continue
    nextMeeting = { date: md, year: y, month: m, diff: diffDays }
    break
  }

  if (!nextMeeting) {
    console.log(`  · ${clubName}: D-14 이내 모임 없음 → 스킵`)
    continue
  }

  const key = `[정기모임-${nextMeeting.year}-${nextMeeting.month}]`
  const { data: existing } = await a.from('announcements').select('id')
    .eq('club_id', p.club_id).ilike('title', `${key}%`).maybeSingle()

  if (existing) {
    console.log(`  ⊙ ${clubName}: ${key} 공지 이미 있음 → 스킵`)
    skipped++
    continue
  }

  const ds   = fmtDateKo(nextMeeting.date)
  const ts   = fmtTimeKo(p.start_time)
  const dsEn = nextMeeting.date.toLocaleDateString('en-US', { month: 'long', day: 'numeric', weekday: 'short' })
  const monthEn = nextMeeting.date.toLocaleDateString('en-US', { month: 'long' })
  const expiresAt = new Date(nextMeeting.date.getTime() + 86400000).toISOString()

  let authorId = p.created_by ?? null
  if (!authorId) {
    const { data: officer } = await a.from('club_memberships').select('user_id')
      .eq('club_id', p.club_id).eq('status','approved').in('role',['president','secretary']).limit(1).maybeSingle()
    authorId = officer?.user_id ?? null
  }

  const payload = {
    club_id: p.club_id,
    title: `${key} ${nextMeeting.year}년 ${nextMeeting.month}월 정기모임 안내`,
    title_en: `${key} ${monthEn} Regular Meeting`,
    content: `${nextMeeting.year}년 ${nextMeeting.month}월 정기모임 일정 안내드립니다.\n\n📅 ${ds}${ts}\n📍 ${p.venue ?? '미정'}\n\n정기모임 메뉴에서 참석/불참 여부를 등록해 주세요.`,
    content_en: `Regular meeting on ${dsEn}${ts}. Please RSVP via the Meetings menu.`,
    author_id: authorId,
    is_meeting: true,
    expires_at: expiresAt,
  }

  let { error } = await a.from('announcements').insert(payload)
  if (error && (error.message?.includes('column') || error.code === 'PGRST204' || error.code === '42703')) {
    // is_meeting/expires_at 컬럼 없으면 폴백
    const { is_meeting, expires_at, ...fallback } = payload
    ;({ error } = await a.from('announcements').insert(fallback))
  }
  if (error) {
    console.log(`  ❌ ${clubName}: ${key} INSERT 실패 — ${error.message}`)
    continue
  }
  console.log(`  ✓ ${clubName}: ${key} 공지 등록 (D-${nextMeeting.diff})`)
  created++
}

console.log(`\n=== 백필 완료 ===`)
console.log(`등록: ${created}개  /  스킵(이미 있음): ${skipped}개`)
