import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

console.log('▶ 모든 클럽의 round_scores (최근 50건, created_at desc):')
const { data, error } = await a.from('round_scores')
  .select('*, users:user_id(full_name), clubs(name)')
  .order('created_at', { ascending: false }).limit(50)
if (error) console.log('  ❌', error.message)
else if (!data?.length) console.log('  ❌ round_scores 테이블 비어 있음!')
else data.forEach(s => console.log(`  ${s.created_at?.slice(0,16)} ${s.clubs?.name} ${s.users?.full_name} ${s.year}-${s.month} gross=${s.gross_score} net=${s.net_score} hc=${s.handicap_used} played=${s.played_at}`))

console.log('\n▶ 2026-06 한정:')
const { data: june } = await a.from('round_scores').select('*, users(full_name), clubs(name)').eq('year',2026).eq('month',6)
console.log(`  ${june?.length ?? 0}건`)
june?.forEach(s => console.log(`    ${s.clubs?.name} ${s.users?.full_name} ${s.gross_score}`))

console.log('\n▶ 6월 finance_transactions (type=fine):')
const { data: fines } = await a.from('finance_transactions')
  .select('*, users:member_id(full_name), clubs(name)')
  .eq('type','fine').gte('transaction_date','2026-06-01').lte('transaction_date','2026-06-30')
console.log(`  ${fines?.length ?? 0}건`)
fines?.forEach(f => console.log(`    ${f.transaction_date} ${f.clubs?.name} ${f.users?.full_name} ${f.amount} paid=${f.paid} kind=${f.fine_kind} desc=${f.description}`))
