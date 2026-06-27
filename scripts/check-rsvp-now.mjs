// 300 클럽 RSVP popup 무한 재출현 원인 추적 — DB 직접 검사 + API 호출 시뮬레이션
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const a = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const DMPLANT = '78392f9f-c048-423f-8cf8-1ade740cc2f9'
const CLUB300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'
const MGF     = '0b9b3498-f5c0-42a2-8fa2-1eafeafbf206'

// 1. 현재 베트남 날짜
const now = new Date(Date.now() + 7*60*60*1000)
const today = { y: now.getUTCFullYear(), m: now.getUTCMonth()+1, d: now.getUTCDate() }
console.log(`▶ 오늘 베트남: ${today.y}-${today.m}-${today.d}`)

// 2. 두 클럽의 다음 모임 + 회장님 RSVP 상태
for (const club of [{ id: CLUB300, name: '300' }, { id: MGF, name: 'MGF' }]) {
  console.log(`\n━━━ ${club.name} ━━━`)
  const { data: pat } = await a.from('recurring_meetings').select('*').eq('club_id', club.id).maybeSingle()
  if (!pat) { console.log('  패턴 없음'); continue }

  // 다음 모임 계산 (이번 달, 다음 달)
  const findMtg = (y, m) => {
    const first = new Date(Date.UTC(y, m-1, 1))
    let diff = pat.day_of_week - first.getUTCDay()
    if (diff < 0) diff += 7
    const d = 1 + diff + (pat.week_of_month - 1) * 7
    return new Date(Date.UTC(y, m-1, d))
  }
  for (let off = 0; off <= 1; off++) {
    let y = today.y, m = today.m + off
    if (m > 12) { m = 1; y++ }
    const mtg = findMtg(y, m)
    const diffDays = Math.round((mtg.getTime() - Date.UTC(today.y, today.m-1, today.d)) / 86400000)
    if (diffDays < -1) continue   // 지난 모임 skip
    const { data: att } = await a.from('meeting_attendances').select('*')
      .eq('club_id', club.id).eq('user_id', DMPLANT)
      .eq('year', y).eq('month', m).maybeSingle()
    console.log(`  ${y}-${m}-${mtg.getUTCDate()} (D-${diffDays}):  RSVP = ${att?.status ?? '❌ 없음'}${att ? ` (saved ${att.responded_at?.slice(0,16)})` : ''}`)
  }
}

// 3. 안한순(300 회장) 으로 로그인해서 API 실제 호출 — 권한·RLS 정상인지
console.log('\n━━━ 안한순(300 회장) 으로 API 호출 시뮬레이션 ━━━')
const c = createClient(URL, ANON, { auth: { persistSession: false } })
const { error: signErr } = await c.auth.signInWithPassword({ email: 'hsahn@ilshin.co.kr', password: '12345678' })
if (signErr) { console.log('  ❌ 로그인:', signErr.message) }
else {
  // 안한순 본인 RSVP 저장 시도 (300 클럽, 7월, attending)
  const { error: rsvpErr } = await c.from('meeting_attendances').upsert(
    { club_id: CLUB300, user_id: '9de9bbf3-609a-4ebf-b13c-1857b6ba7eed', year: 2026, month: 12, status: 'attending', responded_at: new Date().toISOString() },
    { onConflict: 'club_id,user_id,year,month' },
  )
  console.log('  본인 응답 upsert (300 클럽 12월):', rsvpErr?.message ?? '✓ 성공')

  // 안한순(회장)이 최성복(member) 의 응답 대리 저장
  const { error: proxyErr } = await c.from('meeting_attendances').upsert(
    { club_id: CLUB300, user_id: DMPLANT, year: 2026, month: 12, status: 'attending', responded_at: new Date().toISOString() },
    { onConflict: 'club_id,user_id,year,month' },
  )
  console.log('  회장이 최성복 대리 응답 (300 12월):', proxyErr?.message ?? '✓ 성공')
}
await c.auth.signOut().catch(()=>{})

// 4. 테스트 잔재 청소
await a.from('meeting_attendances').delete().eq('club_id', CLUB300).eq('year', 2026).eq('month', 12)
console.log('\n✓ 테스트 데이터 정리 완료')
