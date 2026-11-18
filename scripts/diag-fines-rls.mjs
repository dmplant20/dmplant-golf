import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

console.log('━━━ admin: finance_transactions (type=fine) 전체 ━━━')
const { data: allFines } = await admin.from('finance_transactions').select('*, users:member_id(full_name), clubs(name)').eq('type','fine').order('created_at',{ascending:false}).limit(20)
console.log(`${allFines?.length ?? 0}건`)
allFines?.forEach(f => console.log(`  ${f.transaction_date} ${f.clubs?.name} ${f.users?.full_name} ${f.amount} paid=${f.paid} kind=${f.fine_kind}`))

console.log('\n━━━ admin: round_scores 전체 (최근) ━━━')
const { count: scoreCount } = await admin.from('round_scores').select('*',{count:'exact',head:true})
console.log(`총 round_scores: ${scoreCount}건`)

// 일반회원 (박창수 — MGF member, 시도해보자)
console.log('\n━━━ 안한순 (MGF member) 로 — 다른 사람 데이터 보는지 ━━━')
const c = createClient(URL, ANON, { auth: { persistSession: false } })
const { error: sErr } = await c.auth.signInWithPassword({ email: 'hsahn@ilshin.co.kr', password: '12345678' })
if (sErr) { console.log('로그인 실패:', sErr.message); process.exit(1) }

// 안한순 본인 user_id
const me = (await c.auth.getUser()).data.user.id
console.log(`내 user_id: ${me.slice(0,8)}`)

// 모든 club 6월 round_scores
const { data: allScores, error: scErr } = await c.from('round_scores')
  .select('user_id, gross_score, club_id, users:user_id(full_name)')
  .eq('year', 2026).eq('month', 6)
console.log(`\nround_scores 6월: ${scErr?.message ?? `${allScores?.length}건`}`)
allScores?.forEach(s => console.log(`  ${s.users?.full_name} ${s.gross_score} (mine=${s.user_id === me})`))

// 모든 club 6월 finance_transactions
const { data: allFinesMember, error: fErr } = await c.from('finance_transactions')
  .select('*, users:member_id(full_name)')
  .gte('transaction_date','2026-06-01').lte('transaction_date','2026-06-30')
console.log(`\nfinance_transactions 6월: ${fErr?.message ?? `${allFinesMember?.length}건`}`)
allFinesMember?.forEach(f => console.log(`  ${f.transaction_date} ${f.users?.full_name} type=${f.type} amount=${f.amount} mine=${f.member_id === me}`))

await c.auth.signOut().catch(()=>{})

// 더 결정적: 회장님 본인 (최성복) 으로
console.log('\n━━━ 최성복 (회장님 본인) 으로 ━━━')
// 최성복 비밀번호 모름. dmplant@naver.com — 비번 모름. 패스. 대신 다른 일반회원으로
const c2 = createClient(URL, ANON, { auth: { persistSession: false } })
const { error: s2Err } = await c2.auth.signInWithPassword({ email: '2000inho@hanmail.net', password: '12345678' })
if (s2Err) { console.log('황인호 로그인 실패:', s2Err.message); }
else {
  const meId = (await c2.auth.getUser()).data.user.id
  console.log(`황인호 user_id: ${meId.slice(0,8)}`)

  const { data: hyScores } = await c2.from('round_scores').select('user_id, gross_score, users:user_id(full_name)').eq('year',2026).eq('month',6)
  console.log(`황인호가 보는 6월 스코어: ${hyScores?.length ?? 0}건`)
  hyScores?.forEach(s => console.log(`  ${s.users?.full_name} ${s.gross_score} (본인=${s.user_id === meId})`))

  const { data: hyFines } = await c2.from('finance_transactions').select('*, users:member_id(full_name)').gte('transaction_date','2026-06-01').lte('transaction_date','2026-06-30')
  console.log(`황인호가 보는 6월 거래: ${hyFines?.length ?? 0}건`)
  hyFines?.forEach(f => console.log(`  ${f.transaction_date} ${f.users?.full_name} type=${f.type} ${f.amount} 본인=${f.member_id === meId}`))
}
