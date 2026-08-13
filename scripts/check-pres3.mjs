import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const CLUB300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'
const MGF = '0b9b3498-f5c0-42a2-8fa2-1eafeafbf206'

// recorded_by 78392f9f 가 누구인지
const { data: rb } = await a.from('users').select('*').like('id', '78392f9f%')
console.log('recorded_by 78392f9f:', rb)

// MGF 회장 찾기
const { data: pres } = await a.from('club_memberships').select('*, users:user_id(id, full_name, email)').eq('club_id', MGF).eq('role', 'president')
console.log('\nMGF 회장:', pres)

// 300 회장
const { data: pres300 } = await a.from('club_memberships').select('*, users:user_id(id, full_name, email)').eq('club_id', CLUB300).eq('role', 'president')
console.log('\n300 회장:', pres300)

// 78392f9f 의 300 멤버십
const fullId = rb?.[0]?.id
if (fullId) {
  const { data: mem } = await a.from('club_memberships').select('*, clubs(name)').eq('user_id', fullId)
  console.log(`\n78392f9f (${rb[0].full_name}) 의 멤버십:`)
  mem?.forEach(m => console.log(`  ${m.clubs?.name} status=${m.status} role=${m.role}`))
}

// 가장 최근 finance_transactions (모든 클럽) — created_by 추적
console.log('\n━━━ 최근 finance INSERT — 클럽별 ━━━')
const { data: ft } = await a.from('finance_transactions').select('*, users:member_id(full_name)').order('created_at', { ascending: false }).limit(15)
ft?.forEach(x => console.log(`  ${x.type} club=${x.club_id?.slice(0,8)} member=${x.users?.full_name} amt=${x.amount} created=${x.created_at?.slice(11,19)} recorded_by=${x.recorded_by?.slice(0,8)}`))
