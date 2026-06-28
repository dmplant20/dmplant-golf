import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const a = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const CLUB300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'

console.log('━━━ 300 club_memberships — status 별 ━━━')
const { data: m } = await a.from('club_memberships').select('status, role, club_handicap, users:user_id(full_name)').eq('club_id', CLUB300)
const byStatus = {}
m?.forEach(x => { (byStatus[x.status] ??= []).push(`${x.users?.full_name} (${x.role}, HC=${x.club_handicap})`) })
Object.entries(byStatus).forEach(([s, arr]) => { console.log(`  ${s}: ${arr.length}명`); arr.forEach(n => console.log(`    ${n}`)) })

// 실제 client 가 점수 입력하면 어떤 RLS 결과인지 — 안한순 으로 300 6월 다른 회원 점수 INSERT 테스트
console.log('\n━━━ 안한순(300 회원) 으로 다른회원 점수 INSERT 가능한지 ━━━')
const c = createClient(URL, ANON, { auth: { persistSession: false } })
const { error: sErr } = await c.auth.signInWithPassword({ email: 'hsahn@ilshin.co.kr', password: '12345678' })
if (sErr) { console.log('로그인 실패:', sErr.message); process.exit(1) }
const me = (await c.auth.getUser()).data.user.id

// 이영규 user_id 찾기 — admin 으로
const { data: lyg } = await a.from('users').select('id, full_name').eq('full_name', '이영규').single()
console.log(`이영규 user_id: ${lyg?.id}`)

const { error: insErr } = await c.from('round_scores').upsert({
  club_id: CLUB300, user_id: lyg.id, year: 2026, month: 6,
  gross_score: 88, handicap_used: 8, net_score: 80, played_at: '2026-06-26',
}, { onConflict: 'club_id,user_id,year,month' })
console.log(`  RSULT: ${insErr ? `❌ ${insErr.message}` : '✓ INSERT 성공 (RLS 통과)'}`)
// 정리
await a.from('round_scores').delete().eq('club_id', CLUB300).eq('user_id', lyg.id).eq('year',2026).eq('month',6)
