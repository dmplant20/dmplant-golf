import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const MGF = '0b9b3498-f5c0-42a2-8fa2-1eafeafbf206'
const CLUB300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'
const CHOI = '78392f9f-c048-423f-8cf8-1ade740cc2f9' // 최성복 = 개발자

console.log('=== MGF 점수 — 누가(recorded_by) 등록했나 ===')
const { data: mgf } = await a.from('round_scores').select('gross_score, recorded_by, users:user_id(full_name)').eq('club_id', MGF).eq('year',2026).eq('month',6)
mgf?.forEach(s => console.log(`  ${s.users?.full_name} ${s.gross_score} recorded_by=${s.recorded_by} ${s.recorded_by===CHOI?'(최성복=개발자)':''}`))

console.log('\n=== 최성복의 MGF 역할 vs 300 역할 ===')
for (const [name, cid] of [['MGF', MGF], ['300', CLUB300]]) {
  const { data: m } = await a.from('club_memberships').select('role, status').eq('club_id', cid).eq('user_id', CHOI).maybeSingle()
  console.log(`  ${name}: role=${m?.role} status=${m?.status}`)
}

console.log('\n=== 300 클럽 멤버 status 분포 (API 가 approved 만 통과시킴) ===')
const { data: mems } = await a.from('club_memberships').select('status, role, users:user_id(full_name)').eq('club_id', CLUB300)
const byStatus = {}
mems?.forEach(m => { byStatus[m.status] = (byStatus[m.status]||0)+1 })
console.log('  ', JSON.stringify(byStatus))

console.log('\n=== 300 클럽 fine 룰 (per_stroke=0 이면 벌금 미생성) ===')
const { data: club } = await a.from('clubs').select('name, fine_handicap_per_stroke, fine_handicap_max, fine_notes, currency').eq('id', CLUB300).single()
console.log(`  ${JSON.stringify(club)}`)
const { data: mgfClub } = await a.from('clubs').select('fine_handicap_per_stroke, fine_handicap_max, fine_notes').eq('id', MGF).single()
console.log(`  MGF: ${JSON.stringify(mgfClub)}`)
