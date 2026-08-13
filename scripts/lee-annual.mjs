import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const {data:c}=await a.from('clubs').select('id,annual_fee,currency').eq('name','MGF').single()
const {data:u}=await a.from('users').select('id').eq('full_name','이상철').single()
// recorder = 최성복 (회장) — recorded_by
const {data:pres}=await a.from('users').select('id').eq('full_name','최성복').single()

// 1) fee_type → annual
const {error:mErr}=await a.from('club_memberships')
  .update({ fee_type:'annual' })
  .eq('club_id', c.id).eq('user_id', u.id)
if(mErr){ console.error('membership 실패:', mErr.message); process.exit(1) }
console.log('✓ 이상철 fee_type = annual')

// 2) 기존 회비 트랜잭션 확인 후 중복 방지
const {data:existing}=await a.from('finance_transactions')
  .select('id,transaction_date,amount')
  .eq('club_id', c.id).eq('member_id', u.id).eq('type','fee')
  .gte('transaction_date','2026-01-01').lt('transaction_date','2027-01-01')

if((existing??[]).length){
  console.log('⚠ 이미 올해 회비 트랜잭션 존재:')
  existing.forEach(r=>console.log(`  ${r.transaction_date}  ${r.amount.toLocaleString()}`))
  console.log('  추가 등록은 건너뜁니다.')
} else {
  // 3) ₫5,000,000 년회비 납부 트랜잭션 등록
  const {error:tErr}=await a.from('finance_transactions').insert({
    club_id: c.id,
    type: 'fee',
    amount: 5_000_000,
    currency: c.currency ?? 'VND',
    description: '이상철 회비 납부 (년납)',
    transaction_date: '2026-01-15',
    recorded_by: pres?.id ?? null,
    member_id: u.id,
  })
  if(tErr){ console.error('insert 실패:', tErr.message); process.exit(1) }
  console.log(`✓ 회비 트랜잭션 등록: ₫5,000,000 (2026-01-15)`)
}

const {data:final}=await a.from('finance_transactions')
  .select('transaction_date,amount,description')
  .eq('club_id', c.id).eq('member_id', u.id).eq('type','fee')
  .order('transaction_date')
console.log('\n이상철 최종 회비 내역:')
final.forEach(r=>console.log(`  ${r.transaction_date}  ${r.amount.toLocaleString()}  ${r.description}`))
