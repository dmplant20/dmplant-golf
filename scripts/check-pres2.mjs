import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const CLUB300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'

// users 테이블 모든 컬럼 확인
const { data: u } = await a.from('users').select('*').ilike('email', '%choyousu%')
console.log('회장님 매칭:', u?.length ?? 0, '명')
u?.forEach(x => console.log(`  ${x.id} ${x.full_name} ${x.email} role=${x.role}`))

// 모든 user 의 email 일부
const { data: all } = await a.from('users').select('id, full_name, email').not('email','is',null).limit(20)
console.log('\n전체 users (top 20):')
all?.forEach(x => console.log(`  ${x.full_name}  ${x.email}`))

console.log('\n━━━ 최근 round_scores (300) ━━━')
const { data: rs } = await a.from('round_scores').select('*, users:user_id(full_name)').eq('club_id', CLUB300).order('created_at', { ascending: false }).limit(10)
rs?.forEach(s => console.log(`  ${s.year}-${s.month} ${s.users?.full_name} g=${s.gross_score} created=${s.created_at} recorded_by=${s.recorded_by?.slice(0,8)}`))

console.log('\n━━━ 최근 finance_transactions (300) ━━━')
const { data: ft } = await a.from('finance_transactions').select('*').eq('club_id', CLUB300).order('created_at', { ascending: false }).limit(10)
ft?.forEach(x => console.log(`  ${x.type} amt=${x.amount} desc=${x.description?.slice(0,40)} date=${x.transaction_date} created=${x.created_at}`))
