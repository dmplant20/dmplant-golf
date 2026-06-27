import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

// 정동수의 1월 회비 납부를 3월로 재배치 (3월 가입 정책 반영)
const {data:c}=await a.from('clubs').select('id').eq('name','MGF').single()
const {data:u}=await a.from('users').select('id').eq('full_name','정동수').single()

const {data:rows}=await a.from('finance_transactions')
  .select('id,transaction_date,description,amount')
  .eq('club_id',c.id).eq('member_id',u.id).eq('type','fee')
  .gte('transaction_date','2026-01-01').lt('transaction_date','2026-02-01')

console.log('대상 행:', rows)

for(const r of (rows??[])){
  const {error}=await a.from('finance_transactions')
    .update({
      transaction_date:'2026-03-15',
      description:'정동수 3월 회비 납부 (가입월)',
    }).eq('id', r.id)
  if(error) console.error('  실패:', error.message)
  else console.log(`  ✓ ${r.id.slice(0,8)} 2026-01-15 → 2026-03-15`)
}

// 4월 행도 description 정리
const {data:apr}=await a.from('finance_transactions')
  .select('id,description')
  .eq('club_id',c.id).eq('member_id',u.id).eq('type','fee')
  .gte('transaction_date','2026-04-01').lt('transaction_date','2026-05-01')

for(const r of (apr??[])){
  await a.from('finance_transactions')
    .update({ description:'정동수 4월 회비 납부' }).eq('id', r.id)
  console.log(`  ✓ 4월 설명 정리`)
}

// 최종 확인
const {data:final}=await a.from('finance_transactions')
  .select('transaction_date,amount,description')
  .eq('club_id',c.id).eq('member_id',u.id).eq('type','fee')
  .order('transaction_date')
console.log('\n정동수 최종 회비 납부 내역:')
final.forEach(r=>console.log(`  ${r.transaction_date}  ${r.amount.toLocaleString()}  ${r.description}`))
