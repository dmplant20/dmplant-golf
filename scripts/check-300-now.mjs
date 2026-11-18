import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const CLUB300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'

console.log('━━━ 300 클럽 round_scores 전체 (모든 월/년) ━━━')
const { data } = await a.from('round_scores').select('*, users:user_id(full_name)').eq('club_id', CLUB300).order('year').order('month')
console.log(`총 ${data?.length ?? 0}건:`)
data?.forEach(s => console.log(`  ${s.year}-${s.month} ${s.users?.full_name} gross=${s.gross_score}`))

console.log('\n━━━ 300 클럽 finance fines 전체 ━━━')
const { data: f } = await a.from('finance_transactions').select('*, users:member_id(full_name)').eq('club_id', CLUB300).eq('type', 'fine').order('transaction_date')
console.log(`총 ${f?.length ?? 0}건:`)
f?.forEach(x => console.log(`  ${x.transaction_date} ${x.users?.full_name} ${x.description} ${x.amount}`))
