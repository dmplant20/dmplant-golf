import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const {data:c}=await a.from('clubs').select('id,currency').eq('name','MGF').single()
const {data:pres}=await a.from('users').select('id').eq('full_name','최성복').single()
const CID=c.id, REC=pres.id, CUR=c.currency

async function uid(n){ const {data}=await a.from('users').select('id').eq('full_name',n).single(); return data.id }

// 공통 멤버십 설정 — monthly, joined 2026-01-01
async function setMembership(userId){
  await a.from('club_memberships').update({
    status:'approved', fee_type:'monthly', joined_at:'2026-01-01'
  }).eq('club_id',CID).eq('user_id',userId)
}

async function feeRow(userId, name, mm){
  return {
    club_id: CID, type:'fee', amount:500_000, currency:CUR,
    description:`${name} ${mm}월 회비 납부`,
    transaction_date:`2026-${String(mm).padStart(2,'0')}-15`,
    recorded_by: REC, member_id: userId,
  }
}

// 1) 임현재 — monthly 등록, 결제 없음
{
  const u = await uid('임현재')
  await setMembership(u)
  console.log('✓ 임현재: monthly, joined 2026-01-01, 결제 없음')
}

// 2) 이규식 — 기존 ₫5M 잘못된 행 삭제 후 1~4월 4행 등록
{
  const u = await uid('이규식')
  await setMembership(u)
  // 기존 fee tx 모두 삭제 후 정상 4개월치 재구성
  const {data:old} = await a.from('finance_transactions').select('id').eq('club_id',CID).eq('member_id',u).eq('type','fee')
  if(old?.length){
    await a.from('finance_transactions').delete().in('id', old.map(r=>r.id))
    console.log(`  - 이규식 기존 ${old.length}건 삭제`)
  }
  const rows = [1,2,3,4].map(mm=>({
    club_id:CID, type:'fee', amount:500_000, currency:CUR,
    description:`이규식 ${mm}월 회비 납부`,
    transaction_date:`2026-${String(mm).padStart(2,'0')}-15`,
    recorded_by: REC, member_id: u,
  }))
  const {error} = await a.from('finance_transactions').insert(rows)
  if(error){ console.error('이규식 insert:', error.message); process.exit(1) }
  console.log('✓ 이규식: monthly, 1~4월 ₫500K × 4 = ₫2,000,000 등록')
}

// 3) 정동수 — 표에 따르면 Jan + Apr (현재 Mar+Apr 인 것을 Jan+Apr 로)
{
  const u = await uid('정동수')
  await a.from('club_memberships').update({
    status:'approved', fee_type:'monthly', joined_at:'2026-01-01'
  }).eq('club_id',CID).eq('user_id',u)

  // 3월 행 → 1월로 재배치
  const {data:mar}=await a.from('finance_transactions')
    .select('id').eq('club_id',CID).eq('member_id',u).eq('type','fee')
    .gte('transaction_date','2026-03-01').lt('transaction_date','2026-04-01')
  for(const r of (mar??[])){
    await a.from('finance_transactions').update({
      transaction_date:'2026-01-15',
      description:'정동수 1월 회비 납부',
    }).eq('id', r.id)
  }
  // 4월 행 설명 정리
  const {data:apr}=await a.from('finance_transactions')
    .select('id').eq('club_id',CID).eq('member_id',u).eq('type','fee')
    .gte('transaction_date','2026-04-01').lt('transaction_date','2026-05-01')
  for(const r of (apr??[])){
    await a.from('finance_transactions').update({
      description:'정동수 4월 회비 납부',
    }).eq('id', r.id)
  }
  console.log('✓ 정동수: monthly, joined Jan, tx=1월+4월')
}

// 4) 이태화 — joined_at 만 1월로 정정 (tx 는 그대로)
{
  const u = await uid('이태화')
  await a.from('club_memberships').update({
    status:'approved', fee_type:'monthly', joined_at:'2026-01-01'
  }).eq('club_id',CID).eq('user_id',u)
  console.log('✓ 이태화: joined Jan 으로 정정')
}

// 5) 최규삼, 신종섭 — 이미 일치, 패스

console.log('\n=== 최종 ledger ===')
for(const n of ['임현재','이규식','정동수','최규삼','신종섭','이태화']){
  const u = await uid(n)
  const {data:mem}=await a.from('club_memberships').select('fee_type,joined_at').eq('club_id',CID).eq('user_id',u).maybeSingle()
  const {data:tx}=await a.from('finance_transactions').select('transaction_date,amount').eq('club_id',CID).eq('member_id',u).eq('type','fee').order('transaction_date')
  const months = (tx??[]).map(r=>Number(r.transaction_date.slice(5,7))).sort((a,b)=>a-b)
  const total = (tx??[]).reduce((s,r)=>s+r.amount,0)
  console.log(`${n.padEnd(4)}  ${mem?.fee_type ?? '-'}  joined=${(mem?.joined_at??'').slice(0,10)}  월:[${months.join(',')}]  합:${total.toLocaleString()}`)
}
