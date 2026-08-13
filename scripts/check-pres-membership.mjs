import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const CLUB300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'

console.log('━━━ 회장님 (choyousu@gmail.com) 정보 ━━━')
const { data: u } = await a.from('users').select('id, full_name, email, role').eq('email', 'choyousu@gmail.com').single()
console.log(`  id=${u?.id}  name=${u?.full_name}  role=${u?.role}`)

console.log('\n━━━ 회장님의 클럽 멤버십 ━━━')
const { data: mems } = await a.from('club_memberships').select('*, clubs(name)').eq('user_id', u.id)
mems?.forEach(m => console.log(`  ${m.clubs?.name}  status=${m.status}  role=${m.role}  hc=${m.club_handicap}`))

console.log('\n━━━ 최근 round_scores 변경 — created_at 으로 정렬 ━━━')
const { data: rs } = await a.from('round_scores').select('*, users:user_id(full_name)').eq('club_id', CLUB300).order('created_at', { ascending: false }).limit(10)
rs?.forEach(s => console.log(`  ${s.year}-${s.month} ${s.users?.full_name} g=${s.gross_score} created=${s.created_at} recorded_by=${s.recorded_by?.slice(0,8)}`))
