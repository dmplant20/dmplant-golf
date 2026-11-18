import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: u } = await a.from('users').select('id,full_name,email').eq('email','dmplant@naver.com').single()
console.log('dmplant:', u)
const { data: ms } = await a.from('club_memberships').select('club_id,role,status,clubs(name)').eq('user_id', u.id)
console.log('\n클럽 멤버십:')
ms.forEach(m => console.log(`  ${m.clubs.name}  ${m.role}  ${m.status}  (club_id=${m.club_id})`))

console.log('\n각 클럽의 payment_info:')
for (const m of ms) {
  const { data: pi } = await a.from('club_payment_info').select('bank_name,bank_account,bank_holder,updated_at').eq('club_id', m.club_id).maybeSingle()
  if (pi) console.log(`  ${m.clubs.name}: ✓ ${pi.bank_name} | ${pi.bank_account} | ${pi.bank_holder}`)
  else console.log(`  ${m.clubs.name}: ❌ payment_info 없음`)
}

// "MGF 골프회" 클럽 — 의문점: MGF 와 다른 클럽인가?
console.log('\n"MGF 골프회" 클럽 정보:')
const { data: mgfGolf } = await a.from('clubs').select('id,name,created_at').eq('name','MGF 골프회').single()
console.log(' ', mgfGolf)
const { count: mgfGolfMems } = await a.from('club_memberships').select('*', { count: 'exact', head: true }).eq('club_id', mgfGolf.id)
console.log('  멤버 수:', mgfGolfMems)
const { count: mgfGolfTxns } = await a.from('finance_transactions').select('*', { count: 'exact', head: true }).eq('club_id', mgfGolf.id)
console.log('  거래 수:', mgfGolfTxns)
