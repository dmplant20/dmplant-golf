import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SK   = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(URL, SK, { auth: { persistSession: false } })

const MGF = '0b9b3498-f5c0-42a2-8fa2-1eafeafbf206'
const CLUB300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'

console.log('━━━ service-role (RLS 우회) ━━━')
const { data: srAll } = await admin.from('round_scores').select('user_id, gross_score, users:user_id(full_name)').eq('year',2026).eq('month',6)
console.log(`총 ${srAll?.length ?? 0}건:`)
srAll?.forEach(s => console.log(`  ${s.users?.full_name} ${s.gross_score}`))

// 안한순 (MGF 일반회원, 300 회장) 으로 로그인
console.log('\n━━━ 안한순 (일반회원) 로그인 후 RLS 적용 SELECT ━━━')
const c = createClient(URL, ANON, { auth: { persistSession: false } })
const { error: sErr } = await c.auth.signInWithPassword({ email: 'hsahn@ilshin.co.kr', password: '12345678' })
if (sErr) console.log(`  ❌ 로그인: ${sErr.message}`)
else {
  // MGF 6월 (안한순은 MGF member)
  const { data: mgfData, error: mgfErr } = await c.from('round_scores')
    .select('user_id, gross_score, users:user_id(full_name)')
    .eq('club_id', MGF).eq('year', 2026).eq('month', 6)
  console.log(`MGF 6월: ${mgfErr?.message ?? `${mgfData?.length}건`}`)
  mgfData?.forEach(s => console.log(`  ${s.users?.full_name} ${s.gross_score}`))

  // 300 6월
  const { data: c300Data, error: c300Err } = await c.from('round_scores')
    .select('user_id, gross_score, users:user_id(full_name)')
    .eq('club_id', CLUB300).eq('year', 2026).eq('month', 6)
  console.log(`\n300 6월: ${c300Err?.message ?? `${c300Data?.length}건`}`)
  c300Data?.forEach(s => console.log(`  ${s.users?.full_name} ${s.gross_score}`))

  // finance_transactions (벌금)
  const { data: fines, error: finesErr } = await c.from('finance_transactions')
    .select('*, users:member_id(full_name)')
    .eq('type','fine').gte('transaction_date','2026-06-01').lte('transaction_date','2026-06-30')
  console.log(`\n6월 벌금 (전체): ${finesErr?.message ?? `${fines?.length}건`}`)
  fines?.forEach(f => console.log(`  ${f.users?.full_name} ${f.amount} paid=${f.paid}`))
}
await c.auth.signOut().catch(()=>{})
