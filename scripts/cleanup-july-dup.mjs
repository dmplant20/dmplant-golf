import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const CLUB300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'

console.log('━━━ 삭제 전 — 300 클럽 7월 round_scores ━━━')
const { data: before } = await a.from('round_scores').select('*, users:user_id(full_name)').eq('club_id', CLUB300).eq('year', 2026).eq('month', 7)
console.log(`총 ${before?.length ?? 0}건:`)
before?.forEach(s => console.log(`  ${s.users?.full_name} gross=${s.gross_score} net=${s.net_score} played_at=${s.played_at}`))

console.log('\n━━━ 300 클럽 7월 핸디 벌금 ━━━')
const { data: f } = await a.from('finance_transactions').select('*').eq('club_id', CLUB300).eq('type', 'fine').like('description', '2026-7%')
console.log(`총 ${f?.length ?? 0}건:`)
f?.forEach(x => console.log(`  ${x.description} amount=${x.amount} date=${x.transaction_date}`))

console.log('\n━━━ 삭제 실행 (회장님 승인) ━━━')
const { error: e1 } = await a.from('round_scores').delete().eq('club_id', CLUB300).eq('year', 2026).eq('month', 7)
console.log(`  round_scores 7월: ${e1?.message ?? '✓ 삭제 완료'}`)
const { error: e2 } = await a.from('finance_transactions').delete().eq('club_id', CLUB300).eq('type', 'fine').like('description', '2026-7%')
console.log(`  finance 7월 벌금: ${e2?.message ?? '✓ 삭제 완료'}`)

console.log('\n━━━ 삭제 후 — 300 클럽 round_scores 전체 ━━━')
const { data: after } = await a.from('round_scores').select('*, users:user_id(full_name)').eq('club_id', CLUB300).order('year').order('month')
console.log(`총 ${after?.length ?? 0}건:`)
after?.forEach(s => console.log(`  ${s.year}-${s.month} ${s.users?.full_name} gross=${s.gross_score}`))
