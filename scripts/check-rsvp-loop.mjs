// 최성복 회장의 300/MGF 클럽 RSVP 상태 직접 확인
// 팝업이 계속 뜨는 이유 = DB 에 RSVP 행이 실제로 없거나 다른 month 에 저장된 것
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const DMPLANT = '78392f9f-c048-423f-8cf8-1ade740cc2f9'  // 최성복
const MGF     = '0b9b3498-f5c0-42a2-8fa2-1eafeafbf206'
const CLUB300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'

// 현재 베트남 날짜
const now = new Date(Date.now() + 7*60*60*1000)
const year = now.getUTCFullYear(), month = now.getUTCMonth()+1, day = now.getUTCDate()
console.log(`▶ 오늘 (베트남): ${year}-${month}-${day}`)

// 각 클럽 패턴 + 다음 모임 날짜
for (const club of [{ id: MGF, name: 'MGF' }, { id: CLUB300, name: '300' }]) {
  console.log(`\n━━━ ${club.name} 클럽 ━━━`)
  const { data: pat } = await a.from('recurring_meetings').select('*').eq('club_id', club.id).maybeSingle()
  if (!pat) { console.log('  패턴 없음'); continue }
  console.log(`  패턴: ${pat.week_of_month}째 ${['일','월','화','수','목','금','토'][pat.day_of_week]} ${pat.start_time}`)

  // 다음 모임 계산 — getNthWeekdayDate
  const findMeeting = (y, m) => {
    const first = new Date(Date.UTC(y, m-1, 1))
    let diff = pat.day_of_week - first.getUTCDay()
    if (diff < 0) diff += 7
    const d = 1 + diff + (pat.week_of_month - 1) * 7
    return new Date(Date.UTC(y, m-1, d))
  }

  // 이번 달 / 다음 달 검사
  for (let off = 0; off <= 1; off++) {
    let y = year, m = month + off
    if (m > 12) { m = 1; y++ }
    const mtg = findMeeting(y, m)
    const diffDays = Math.round((mtg.getTime() - Date.UTC(year, month-1, day)) / 86400000)
    console.log(`  ${y}-${m}-${mtg.getUTCDate()} (D-${diffDays})`)

    // 최성복의 이 모임 RSVP 상태
    const { data: att } = await a.from('meeting_attendances').select('*')
      .eq('club_id', club.id).eq('user_id', DMPLANT).eq('year', y).eq('month', m).maybeSingle()
    if (att) {
      console.log(`    🟢 최성복 RSVP: ${att.status} (응답 ${att.responded_at?.slice(0,16)})`)
    } else {
      console.log(`    ⚪ 최성복 RSVP: 없음 (DB 에 행 없음)`)
    }
  }
}

console.log('\n━━━ 진단 ━━━')
console.log('대시보드 popup 은 `myRsvp === null` 이면 뜸.')
console.log('만약 DB 에 행이 있는데도 팝업이 뜬다면:')
console.log('  → 다른 클럽의 다음 모임 (예: MGF 7월) 응답이 비어 있는 것')
console.log('  → 또는 currentClubId 가 다른 클럽으로 set 되어서 fetch 클럽이 다름')
