import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const CLUB300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'

// loadRsvp 가 실제로 사용하는 쿼리 — users 명시 없이
console.log('▶ Test 1: 현재 코드 쿼리 (users 자동) — 300 클럽 2026-06:')
const { data: d1, error: e1 } = await a.from('round_scores')
  .select('user_id, gross_score, handicap_used, net_score, course_name, users(full_name, full_name_en, name_abbr)')
  .eq('club_id', CLUB300).eq('year', 2026).eq('month', 6)
if (e1) console.log(`  ❌ ${e1.message}`)
else console.log(`  ✓ ${d1?.length ?? 0}건`)
d1?.forEach(r => console.log(`    ${r.users?.full_name} ${r.gross_score}`))

// 명시적 FK 지정 쿼리
console.log('\n▶ Test 2: users:user_id 명시:')
const { data: d2, error: e2 } = await a.from('round_scores')
  .select('user_id, gross_score, handicap_used, net_score, course_name, users:user_id(full_name, full_name_en, name_abbr)')
  .eq('club_id', CLUB300).eq('year', 2026).eq('month', 6)
if (e2) console.log(`  ❌ ${e2.message}`)
else console.log(`  ✓ ${d2?.length ?? 0}건`)
d2?.forEach(r => console.log(`    ${r.users?.full_name} ${r.gross_score}`))

// 명시 + MGF
console.log('\n▶ Test 3: MGF 클럽 동일 쿼리:')
const MGF = '0b9b3498-f5c0-42a2-8fa2-1eafeafbf206'
const { data: d3, error: e3 } = await a.from('round_scores')
  .select('user_id, gross_score, handicap_used, net_score, course_name, users:user_id(full_name, full_name_en, name_abbr)')
  .eq('club_id', MGF).eq('year', 2026).eq('month', 6)
if (e3) console.log(`  ❌ ${e3.message}`)
else console.log(`  ✓ ${d3?.length ?? 0}건`)
d3?.forEach(r => console.log(`    ${r.users?.full_name} ${r.gross_score}`))
