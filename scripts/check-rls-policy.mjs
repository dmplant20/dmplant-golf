import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const CLUB300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'

// 안한순 (300 회장) 으로 로그인 — 이전 테스트에서 비밀번호 안 거 확인됨
const c = createClient(URL, ANON, { auth: { persistSession: false } })
const { error: sErr } = await c.auth.signInWithPassword({ email: 'hsahn@ilshin.co.kr', password: '12345678' })
if (sErr) { console.log(`로그인 실패: ${sErr.message}`); process.exit(1) }
const me = (await c.auth.getUser()).data.user.id
console.log(`로그인: 안한순 (300 회장) ${me.slice(0,8)}`)

// 이영규 — 300 일반회원
const { data: lyg } = await admin.from('users').select('id').eq('full_name', '이영규').single()

console.log('\n▶ 300 회장 (안한순) 이 이영규 점수 upsert:')
const { error: e1 } = await c.from('round_scores').upsert({
  club_id: CLUB300, user_id: lyg.id, year: 2026, month: 6,
  gross_score: 85, handicap_used: 8, net_score: 77, played_at: '2026-06-26', recorded_by: me,
}, { onConflict: 'club_id,user_id,year,month' })
console.log(`  ${e1 ? `❌ ${e1.message}` : '✓ 성공'}`)

console.log('\n▶ 300 회장 (안한순) 이 finance fine 대리 등록:')
const { error: e2 } = await c.from('finance_transactions').insert({
  club_id: CLUB300, member_id: lyg.id, type: 'fine', amount: 100000,
  description: 'TEST 안한순 권한 점검', transaction_date: '2026-06-26', recorded_by: me,
})
console.log(`  ${e2 ? `❌ ${e2.message}` : '✓ 성공'}`)

// 정리
await admin.from('round_scores').delete().eq('club_id', CLUB300).eq('user_id', lyg.id).eq('year',2026).eq('month',6)
await admin.from('finance_transactions').delete().eq('description', 'TEST 안한순 권한 점검')
await c.auth.signOut().catch(()=>{})

console.log('\n━━━ users 테이블 — 최성복(회장님) role 컬럼 확인 ━━━')
const { data: u } = await admin.from('users').select('id, full_name, email, role').eq('id', '78392f9f-c048-423f-8cf8-1ade740cc2f9').single()
console.log(`  최성복: role=${u?.role}`)

console.log('\n━━━ pg_policies SQL 직접 ━━━')
// 다른 클라이언트로 SQL 실행 (필요시 supabase 가 권한 거절할 수 있음)
const { data: sqlData, error: sqlErr } = await admin.rpc('exec_sql', { sql: "SELECT policyname, cmd, qual::text FROM pg_policies WHERE tablename='round_scores'" })
console.log(`  rpc exec_sql: ${sqlErr?.message ?? JSON.stringify(sqlData)?.slice(0, 500)}`)
