import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const CLUB300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'
const DEV = '78392f9f-c048-423f-8cf8-1ade740cc2f9' // 최성복(개발자) = recorded_by

// 입력 점수 (이름 → gross)
const SCORES = {
  '김재현': 90, '전하영': 89, '이영규': 91, '신태용': 101,
  '남재호': 89, 'Jeff Lee': 89, '황인호': 97,
}

// 클럽 정보 — par, 벌금 룰
const { data: club } = await a.from('clubs').select('fine_handicap_per_stroke, fine_handicap_max').eq('id', CLUB300).single()
const perStroke = Number(club.fine_handicap_per_stroke) || 0
const fineMax   = Number(club.fine_handicap_max) || 0

// 6월 모임 정보 — venue/par/date. 기존 최성복 row 에서 가져오기
const { data: existRow } = await a.from('round_scores').select('course_name, course_par, played_at').eq('club_id', CLUB300).eq('year',2026).eq('month',6).limit(1).maybeSingle()
const courseName = existRow?.course_name ?? 'Twin Doves Golf Club'
const coursePar  = existRow?.course_par ?? 72
const playedAt   = existRow?.played_at ?? '2026-06-26'
console.log(`코스: ${courseName}, par ${coursePar}, 날짜 ${playedAt}, per_stroke ${perStroke}, max ${fineMax}\n`)

// 멤버십(핸디) 조회
const { data: mems } = await a.from('club_memberships').select('user_id, club_handicap, users:user_id(full_name)').eq('club_id', CLUB300)
const byName = {}
mems?.forEach(m => { byName[m.users?.full_name] = { user_id: m.user_id, hc: m.club_handicap } })

console.log('=== 점수 등록 ===')
for (const [name, gross] of Object.entries(SCORES)) {
  const mem = byName[name]
  if (!mem) { console.log(`  ⚠️ ${name}: 멤버 못 찾음 — 스킵`); continue }
  const hc = mem.hc ?? null
  const net = hc != null ? gross - hc : null
  const { error } = await a.from('round_scores').upsert({
    club_id: CLUB300, user_id: mem.user_id, year: 2026, month: 6,
    gross_score: gross, handicap_used: hc, net_score: net,
    course_name: courseName, course_par: coursePar, played_at: playedAt, recorded_by: DEV,
  }, { onConflict: 'club_id,user_id,year,month' })
  if (error) { console.log(`  ❌ ${name}: ${error.message}`); continue }

  // 벌금 — net > par 면 핸디초과 ([미납] 상태)
  let fineMsg = ''
  if (perStroke > 0) {
    // 기존 이 회원의 6월 핸디벌금 삭제 (재실행 안전)
    await a.from('finance_transactions').delete()
      .eq('club_id', CLUB300).eq('member_id', mem.user_id).eq('type','fine')
      .or(`description.ilike.2026-6 월례회 핸디%,description.ilike.[미납] 2026-6 월례회 핸디%`)
    if (net != null && net > coursePar) {
      const over = net - coursePar
      let amt = over * perStroke
      if (fineMax > 0 && amt > fineMax) amt = fineMax
      await a.from('finance_transactions').insert({
        club_id: CLUB300, member_id: mem.user_id, type: 'fine', amount: amt,
        description: `[미납] 2026-6 월례회 핸디 초과 (over par ${over}타)`,
        transaction_date: playedAt, recorded_by: DEV,
      })
      fineMsg = ` → 벌금 ${amt.toLocaleString()} (over ${over})`
    }
  }
  console.log(`  ✓ ${name}: gross ${gross}, hc ${hc}, net ${net}${fineMsg}`)
}

console.log('\n=== 등록 후 300 6월 전체 ===')
const { data: all } = await a.from('round_scores').select('gross_score, net_score, handicap_used, users:user_id(full_name)').eq('club_id', CLUB300).eq('year',2026).eq('month',6).order('net_score')
all?.forEach(s => console.log(`  ${s.users?.full_name}: gross ${s.gross_score}, hc ${s.handicap_used}, net ${s.net_score}`))
