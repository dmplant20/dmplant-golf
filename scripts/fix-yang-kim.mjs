import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const {data:c}=await a.from('clubs').select('id,currency').eq('name','MGF').single()
const {data:pres}=await a.from('users').select('id').eq('full_name','최성복').single()
const CID=c.id, REC=pres.id, CUR=c.currency

// ── 1) 양우영 — pending → approved, 연회비 ₫5M 등록 ───────────────────────
{
  const {data:u}=await a.from('users').select('id,full_name,email').eq('full_name','양우영').maybeSingle()
  if(!u){ console.error('❌ 양우영 user 없음'); process.exit(1) }
  await a.from('club_memberships').update({
    status:'approved', fee_type:'annual', joined_at:'2026-01-01'
  }).eq('club_id',CID).eq('user_id',u.id)

  // 기존 회비 트랜잭션이 있는지
  const {data:existing}=await a.from('finance_transactions')
    .select('id').eq('club_id',CID).eq('member_id',u.id).eq('type','fee')
  if((existing??[]).length){
    console.log('⚠ 양우영 이미 회비 트랜잭션 존재 — skip insert')
  } else {
    const {error}=await a.from('finance_transactions').insert({
      club_id:CID, type:'fee', amount:5_000_000, currency:CUR,
      description:'양우영 회비 납부 (년납)',
      transaction_date:'2026-05-08',
      recorded_by:REC, member_id:u.id,
    })
    if(error){ console.error('양우영 insert:',error.message); process.exit(1) }
    console.log('✓ 양우영: approved, annual, ₫5,000,000 등록 (2026-05-08)')
  }
}

// ── 2) 김진태 — annual → monthly, 5월 ₫5M 1건 삭제 → Jan ₫500K + Apr ₫4.5M ─
{
  const {data:u}=await a.from('users').select('id').eq('full_name','김진태').single()

  await a.from('club_memberships').update({
    fee_type:'monthly', joined_at:'2026-01-01'
  }).eq('club_id',CID).eq('user_id',u.id)

  // 기존 ₫5M 단일 행 삭제
  const {data:old}=await a.from('finance_transactions')
    .select('id,transaction_date,amount')
    .eq('club_id',CID).eq('member_id',u.id).eq('type','fee')
  console.log('  김진태 기존 회비:', old)
  if(old?.length){
    await a.from('finance_transactions').delete().in('id', old.map(r=>r.id))
    console.log(`  - 김진태 기존 ${old.length}건 삭제`)
  }

  // 1월 ₫500K, 4월 ₫4.5M 재등록
  const rows = [
    { club_id:CID, type:'fee', amount:500_000,    currency:CUR,
      description:'김진태 1월 회비 납부',
      transaction_date:'2026-01-15', recorded_by:REC, member_id:u.id },
    { club_id:CID, type:'fee', amount:4_500_000, currency:CUR,
      description:'김진태 4월 회비 (9개월 선납)',
      transaction_date:'2026-04-15', recorded_by:REC, member_id:u.id },
  ]
  const {error}=await a.from('finance_transactions').insert(rows)
  if(error){ console.error('김진태 insert:',error.message); process.exit(1) }
  console.log('✓ 김진태: monthly, 1월 ₫500K + 4월 ₫4.5M 등록')
}

// ── 잔액 검증 ─────────────────────────────────────────────────────────────
const {data:club}=await a.from('clubs').select('carryover_amount').eq('id',CID).single()
const {data:tx}=await a.from('finance_transactions').select('type,amount').eq('club_id',CID)
let inc=0, exp=0
tx.forEach(t=>{ if(['fee','donation','fine','other'].includes(t.type)) inc+=t.amount; else if(t.type==='expense') exp+=t.amount })
const bal = (club.carryover_amount??0) + inc - exp
console.log('\n=== 잔액 검증 ===')
console.log(`이월금: ${(club.carryover_amount??0).toLocaleString().padStart(15)}`)
console.log(`수입  : ${inc.toLocaleString().padStart(15)}`)
console.log(`지출  : ${exp.toLocaleString().padStart(15)}`)
console.log(`잔액  : ${bal.toLocaleString().padStart(15)}`)
console.log(`예상  : 105,710,000`)
console.log(`일치  : ${bal === 105_710_000 ? '✅' : '❌'}`)
