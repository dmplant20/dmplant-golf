// 진짜 다른 회원 데이터가 안 보이는지 — 실제 회원으로 로그인 후 client 와 동일한 쿼리
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const MGF = '0b9b3498-f5c0-42a2-8fa2-1eafeafbf206'
const CLUB300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'

console.log('━━━ admin view: 6월 round_scores 모든 클럽 ━━━')
const { data: a1 } = await admin.from('round_scores').select('*, users:user_id(full_name), clubs(name)').eq('year',2026).eq('month',6).order('club_id')
console.log(`총 ${a1?.length ?? 0}건:`)
a1?.forEach(s => console.log(`  ${s.clubs?.name} | ${s.users?.full_name} | gross=${s.gross_score}`))

console.log('\n━━━ 황인호 (300 일반회원) 로 로그인 후 실제 client 와 동일 쿼리 ━━━')
const c = createClient(URL, ANON, { auth: { persistSession: false } })
const { error: sErr } = await c.auth.signInWithPassword({ email: '2000inho@hanmail.net', password: '12345678' })
if (sErr) {
  console.log(`황인호 로그인 실패: ${sErr.message} → 안한순으로 시도`)
  await c.auth.signInWithPassword({ email: 'hsahn@ilshin.co.kr', password: '12345678' })
}
const me = (await c.auth.getUser()).data.user
console.log(`로그인 user: ${me.id.slice(0,8)} (${me.email})`)

// 정확히 meetings/page.tsx 의 loadRsvp 쿼리 — 300 클럽 6월
console.log('\n▶ 300 6월 (회원이 보는 client 와 동일 쿼리):')
const { data: cs300, error: cs300Err } = await c.from('round_scores')
  .select('user_id, gross_score, handicap_used, net_score, course_name, users:user_id(full_name, full_name_en, name_abbr)')
  .eq('club_id', CLUB300).eq('year', 2026).eq('month', 6)
console.log(`  결과: ${cs300Err?.message ?? `${cs300?.length}건`}`)
cs300?.forEach(s => console.log(`    ${s.users?.full_name} ${s.gross_score} ${s.user_id === me.id ? '(본인)' : ''}`))

console.log('\n▶ MGF 6월:')
const { data: cMgf } = await c.from('round_scores')
  .select('user_id, gross_score, handicap_used, net_score, course_name, users:user_id(full_name, full_name_en, name_abbr)')
  .eq('club_id', MGF).eq('year', 2026).eq('month', 6)
console.log(`  결과: ${cMgf?.length ?? 0}건`)
cMgf?.forEach(s => console.log(`    ${s.users?.full_name} ${s.gross_score} ${s.user_id === me.id ? '(본인)' : ''}`))

await c.auth.signOut().catch(()=>{})

// RLS 정책 직접 확인 — pg_policies 통해
console.log('\n━━━ RLS 정책 점검 (pg_policies) ━━━')
const { data: pol, error: polErr } = await admin.rpc('exec_sql', { sql: "SELECT tablename, policyname, cmd, qual::text FROM pg_policies WHERE tablename = 'round_scores'" })
if (polErr) {
  // RPC 가 없을 수 있음 — 다른 방법
  console.log(`  rpc exec_sql 없음 (${polErr.message}) — direct schema 조회는 service-role API 한계`)
  console.log(`  → Supabase 대시보드 SQL 에디터에서:`)
  console.log(`     SELECT * FROM pg_policies WHERE tablename = 'round_scores';`)
} else {
  console.log(pol)
}
