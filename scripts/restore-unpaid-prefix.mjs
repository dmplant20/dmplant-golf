import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// 정책 변경: 자동 벌금은 [미납] 상태로 시작.
// 이전에 [미납] 없이 INSERT 된 자동 벌금에 prefix 복원 — 수납 분리 동작 위함.
// 단 회장님이 직접 finance 에서 등록한 임의 벌금 (description 가 다른) 은 영향 없음.
console.log('━━━ [미납] prefix 없는 월례회 자동 벌금 찾기 ━━━')
const { data: fines } = await a.from('finance_transactions').select('id, description, amount, transaction_date, club_id')
  .eq('type', 'fine')
const targets = (fines ?? []).filter(f =>
  typeof f.description === 'string' &&
  !f.description.startsWith('[미납]') &&
  /(\d{4}-\d{1,2}\s월례회)/.test(f.description)
)
console.log(`복원 대상: ${targets.length}건`)
targets.forEach(t => console.log(`  ${t.transaction_date} ${t.description.slice(0,50)} ${t.amount}`))

if (targets.length > 0) {
  for (const t of targets) {
    await a.from('finance_transactions').update({ description: '[미납] ' + t.description }).eq('id', t.id)
  }
  console.log('\n✓ prefix 복원 완료')
}

console.log('\n━━━ 복원 후 — 300 클럽 fines ━━━')
const { data: after } = await a.from('finance_transactions').select('*, users:member_id(full_name)').eq('club_id', '59138dad-8bf6-47e9-81df-8f47d6a45143').eq('type', 'fine')
after?.forEach(x => console.log(`  ${x.transaction_date} ${x.users?.full_name} ${x.description?.slice(0,60)} ${x.amount}`))
