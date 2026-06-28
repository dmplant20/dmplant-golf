import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const CLUB300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'

console.log('=== 300 6월 벌금 전체 (미납 포함) ===')
const { data: f } = await a.from('finance_transactions').select('amount, description, users:member_id(full_name)').eq('club_id', CLUB300).eq('type','fine').order('amount', { ascending: false })
let total = 0, unpaid = 0
f?.forEach(x => {
  const isUnpaid = x.description?.startsWith('[미납]')
  total += x.amount
  if (isUnpaid) unpaid += x.amount
  console.log(`  ${x.users?.full_name}: ${x.amount.toLocaleString()} ${isUnpaid?'[미납]':'[납부]'} — ${x.description?.replace('[미납] ','')}`)
})
console.log(`\n  벌금 총액: ${total.toLocaleString()} (미납 ${unpaid.toLocaleString()})`)
console.log(`  점수: 8명, 벌금: ${f?.length}건`)
