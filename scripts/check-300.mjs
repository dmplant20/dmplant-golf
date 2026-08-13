import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const CLUB300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'

console.log('━━━ 300 클럽 전체 round_scores (모든 월/년) ━━━')
const { data } = await a.from('round_scores').select('*, users:user_id(full_name)').eq('club_id', CLUB300).order('year').order('month')
console.log(`총 ${data?.length ?? 0}건:`)
data?.forEach(s => console.log(`  ${s.year}-${s.month} ${s.users?.full_name} gross=${s.gross_score} net=${s.net_score} hc=${s.handicap_used} played=${s.played_at}`))

console.log('\n━━━ 300 6월 attendances ━━━')
const { data: at } = await a.from('meeting_attendances').select('*, users:user_id(full_name)').eq('club_id', CLUB300).eq('year', 2026).eq('month', 6)
at?.forEach(x => console.log(`  ${x.users?.full_name}: ${x.status}`))

console.log('\n━━━ 300 클럽 멤버십 ━━━')
const { data: m } = await a.from('club_memberships').select('*, users:user_id(full_name)').eq('club_id', CLUB300).eq('status', 'active')
console.log(`active ${m?.length ?? 0}명:`)
m?.forEach(x => console.log(`  ${x.users?.full_name}  HC=${x.club_handicap}`))
