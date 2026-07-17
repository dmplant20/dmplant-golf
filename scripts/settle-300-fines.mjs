import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const CLUB300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'

// 핸디 초과 벌금 = 전원 납부 ([미납] prefix 제거) / 결장 = 미납 유지
console.log('=== 핸디 초과 벌금 → 납부 처리 ([미납] 제거) ===')
const { data: fines } = await a.from('finance_transactions').select('id, amount, description, users:member_id(full_name)').eq('club_id', CLUB300).eq('type','fine')
for (const f of fines ?? []) {
  const isHandi = f.description?.includes('핸디 초과')
  const isUnpaid = f.description?.startsWith('[미납]')
  if (isHandi && isUnpaid) {
    const newDesc = f.description.replace(/^\[미납\]\s*/, '')
    await a.from('finance_transactions').update({ description: newDesc }).eq('id', f.id)
    console.log(`  ✓ ${f.users?.full_name} ${f.amount.toLocaleString()} → 납부`)
  } else if (isHandi && !isUnpaid) {
    console.log(`  - ${f.users?.full_name} ${f.amount.toLocaleString()} (이미 납부)`)
  }
}

console.log('\n=== 결장 벌금 → 미납 유지 ===')
;(fines ?? []).filter(f => f.description?.includes('결장')).forEach(f => {
  const isUnpaid = f.description?.startsWith('[미납]')
  console.log(`  ${f.users?.full_name} ${f.amount.toLocaleString()} ${isUnpaid?'[미납] ✓':'[납부] ⚠️'}`)
})

console.log('\n=== 최종 상태 ===')
const { data: after } = await a.from('finance_transactions').select('amount, description, users:member_id(full_name)').eq('club_id', CLUB300).eq('type','fine').order('amount',{ascending:false})
let paid=0, unpaid=0
after?.forEach(f => {
  const u = f.description?.startsWith('[미납]')
  if (u) unpaid += f.amount; else paid += f.amount
  console.log(`  ${f.users?.full_name}: ${f.amount.toLocaleString()} ${u?'[미납]':'[납부]'}`)
})
console.log(`\n  납부(잔고합산): ${paid.toLocaleString()}  /  미납: ${unpaid.toLocaleString()}`)
