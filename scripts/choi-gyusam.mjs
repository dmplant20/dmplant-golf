import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const {data:c}=await a.from('clubs').select('id,monthly_fee,currency').eq('name','MGF').single()
const {data:u}=await a.from('users').select('id,full_name,full_name_en,email').eq('full_name','최규삼').maybeSingle()
if(!u){ console.error('❌ 최규삼 user 없음 — bulk-register 먼저 실행 필요'); process.exit(1) }
console.log('user:', u)

const {data:pres}=await a.from('users').select('id').eq('full_name','최성복').single()

// 1) 멤버십 — 월회비, 1월 가입(올해 초)
const {data:existingMem}=await a.from('club_memberships')
  .select('id, status, fee_type, joined_at')
  .eq('club_id', c.id).eq('user_id', u.id).maybeSingle()

if(existingMem){
  const {error}=await a.from('club_memberships').update({
    status:'approved', fee_type:'monthly', joined_at:'2026-01-01',
  }).eq('id', existingMem.id)
  if(error){ console.error('membership update:', error.message); process.exit(1) }
  console.log('✓ 멤버십 갱신: approved, monthly, 2026-01-01')
} else {
  const {error}=await a.from('club_memberships').insert({
    club_id: c.id, user_id: u.id,
    role:'member', status:'approved', fee_type:'monthly',
    joined_at:'2026-01-01',
  })
  if(error){ console.error('membership insert:', error.message); process.exit(1) }
  console.log('✓ 멤버십 신규 등록: approved, monthly, 2026-01-01')
}

// 2) 1월 회비 트랜잭션 — 중복 방지
const {data:existing}=await a.from('finance_transactions')
  .select('id,transaction_date,amount')
  .eq('club_id', c.id).eq('member_id', u.id).eq('type','fee')
  .gte('transaction_date','2026-01-01').lt('transaction_date','2026-02-01')

if((existing??[]).length){
  console.log('⚠ 이미 1월 회비 존재 — 추가 등록 안 함')
  existing.forEach(r=>console.log(`  ${r.transaction_date}  ${r.amount.toLocaleString()}`))
} else {
  const {error}=await a.from('finance_transactions').insert({
    club_id: c.id, type:'fee', amount: 500_000, currency: c.currency ?? 'VND',
    description: '최규삼 1월 회비 납부',
    transaction_date: '2026-01-15',
    recorded_by: pres?.id ?? null,
    member_id: u.id,
  })
  if(error){ console.error('insert:', error.message); process.exit(1) }
  console.log('✓ 1월 회비 ₫500,000 등록 (2026-01-15)')
}

const {data:final}=await a.from('finance_transactions')
  .select('transaction_date,amount,description')
  .eq('club_id', c.id).eq('member_id', u.id).eq('type','fee')
  .order('transaction_date')
console.log('\n최규삼 회비 내역:')
final.forEach(r=>console.log(`  ${r.transaction_date}  ${r.amount.toLocaleString()}  ${r.description}`))
