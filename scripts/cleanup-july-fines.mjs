import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const CLUB300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'

console.log('━━━ 삭제 전: 300 클럽 7월 fines ━━━')
const { data: before } = await a.from('finance_transactions').select('*, users:member_id(full_name)').eq('club_id', CLUB300).eq('type', 'fine').eq('transaction_date', '2026-07-24')
before?.forEach(x => console.log(`  ${x.users?.full_name} ${x.description} ${x.amount}`))

console.log('\n━━━ 삭제 실행 ━━━')
const { error } = await a.from('finance_transactions').delete().eq('club_id', CLUB300).eq('type', 'fine').eq('transaction_date', '2026-07-24')
console.log(`  ${error?.message ?? '✓ 4건 삭제 완료'}`)

console.log('\n━━━ 삭제 후: 300 클럽 모든 fines ━━━')
const { data: after } = await a.from('finance_transactions').select('*, users:member_id(full_name)').eq('club_id', CLUB300).eq('type', 'fine')
console.log(`총 ${after?.length ?? 0}건`)
after?.forEach(x => console.log(`  ${x.transaction_date} ${x.users?.full_name} ${x.description} ${x.amount}`))
