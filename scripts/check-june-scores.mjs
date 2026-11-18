// 6월 월례회 스코어 + 벌금 + 핸디 룰 현황 점검
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const MGF     = '0b9b3498-f5c0-42a2-8fa2-1eafeafbf206'
const CLUB300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'

console.log('━━━ 1. round_scores 테이블 존재 여부 + 6월 스코어 ━━━')
for (const club of [{ id: MGF, name: 'MGF' }, { id: CLUB300, name: '300' }]) {
  // 일단 컬럼명 확인
  const { data, error } = await a.from('round_scores').select('*').limit(1)
  if (error) { console.log(`  ❌ round_scores 테이블 없음: ${error.message}`); break }
  if (data?.[0]) {
    console.log(`  ✓ round_scores 컬럼: ${Object.keys(data[0]).join(', ')}`)
    break
  }
}

// 6월 스코어
const { data: juneScores } = await a.from('round_scores').select('*, users(full_name)')
  .gte('round_date', '2026-06-01').lte('round_date', '2026-06-30')
console.log(`\n  2026-06 스코어 총 ${juneScores?.length ?? 0}건:`)
juneScores?.slice(0, 20).forEach((s) => {
  console.log(`    ${s.round_date} ${s.users?.full_name} gross=${s.gross_score} net=${s.net_score} hc=${s.handicap_used} club=${s.club_id?.slice(0,8)}`)
})

console.log('\n━━━ 2. 클럽별 벌금 룰 (fine_handicap_*) ━━━')
const { data: clubs } = await a.from('clubs').select('id, name, fine_handicap_per_stroke, fine_handicap_max, fine_notes, currency')
clubs?.forEach((c) => {
  console.log(`  ${c.name.padEnd(10)}  per_stroke=${c.fine_handicap_per_stroke ?? '미설정'}  max=${c.fine_handicap_max ?? '미설정'}  notes=${c.fine_notes ?? '-'}`)
})

console.log('\n━━━ 3. 회원별 클럽 핸디 (club_handicap) ━━━')
const { data: mems } = await a.from('club_memberships')
  .select('club_id, club_handicap, users(full_name)')
  .eq('status','approved')
const hasHc = (mems ?? []).filter((m) => m.club_handicap != null)
console.log(`  핸디 설정된 회원: ${hasHc.length}명 / 전체 ${mems?.length ?? 0}명`)
const byClub = new Map()
hasHc.forEach((m) => byClub.set(m.club_id, (byClub.get(m.club_id) ?? 0) + 1))
byClub.forEach((cnt, cid) => {
  const cn = clubs?.find((c) => c.id === cid)?.name
  console.log(`    ${cn}: ${cnt}명`)
})

console.log('\n━━━ 4. 벌금 거래 (finance_transactions where type=fine) ━━━')
const { data: fines } = await a.from('finance_transactions').select('*')
  .eq('type','fine').gte('transaction_date', '2026-06-01').lte('transaction_date', '2026-06-30')
console.log(`  6월 벌금 거래: ${fines?.length ?? 0}건`)
fines?.forEach((f) => console.log(`    ${f.transaction_date} ${f.amount} ${f.description ?? ''}`))
