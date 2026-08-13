import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// 6월 스코어 — year/month 컬럼 기준
const { data: scores } = await a.from('round_scores').select('*, users(full_name), clubs(name)')
  .eq('year', 2026).eq('month', 6).order('created_at', { ascending: false })
console.log(`▶ 2026-06 round_scores: ${scores?.length ?? 0}건`)
scores?.forEach(s => console.log(`  ${s.clubs?.name} | ${s.users?.full_name} | gross=${s.gross_score} hc=${s.handicap_used} net=${s.net_score} course=${s.course_name} played=${s.played_at}`))

// 최근 모든 스코어
console.log('\n▶ 최근 round_scores 전체 (created_at desc, top 20):')
const { data: recent } = await a.from('round_scores').select('*, users(full_name), clubs(name)').order('created_at',{ascending:false}).limit(20)
recent?.forEach(s => console.log(`  ${s.created_at?.slice(0,10)} ${s.clubs?.name} ${s.users?.full_name} ${s.year}-${s.month} gross=${s.gross_score} net=${s.net_score}`))

// personal_round_holes 확인 — 개인 스코어카드용
console.log('\n▶ personal_round_holes 컬럼:')
const { data: prh, error: prhErr } = await a.from('personal_round_holes').select('*').limit(1)
if (prhErr) console.log('  ❌', prhErr.message)
else if (prh?.[0]) console.log('  ', Object.keys(prh[0]).join(', '))

// 6월 personal rounds
console.log('\n▶ personal_rounds (개인 라운드) 6월:')
const { data: pr, error: prErr } = await a.from('personal_rounds').select('*, users(full_name)').gte('played_at','2026-06-01').lte('played_at','2026-06-30').limit(20)
if (prErr) console.log('  ❌', prErr.message)
else {
  console.log(`  ${pr?.length ?? 0}건`)
  pr?.forEach(r => console.log(`    ${r.played_at?.slice(0,10)} ${r.users?.full_name} ${r.course_name} gross=${r.gross_score}`))
}
