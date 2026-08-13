import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const MGF = '0b9b3498-f5c0-42a2-8fa2-1eafeafbf206'
const HSAHN = '9de9bbf3-609a-4ebf-b13c-1857b6ba7eed'

// 안한순(MGF 일반회원) 으로 finance_transactions INSERT 시도
const c = createClient(URL, ANON, { auth: { persistSession: false } })
const { error: sErr } = await c.auth.signInWithPassword({ email: 'hsahn@ilshin.co.kr', password: '12345678' })
if (sErr) { console.log('로그인 실패'); process.exit(1) }
const me = (await c.auth.getUser()).data.user.id

console.log('▶ 안한순(MGF member) 으로 벌금 INSERT 시도:')
const { error: insErr } = await c.from('finance_transactions').insert({
  club_id: MGF,
  member_id: HSAHN,
  type: 'fine',
  amount: 100000,
  description: 'TEST 벌금',
  transaction_date: '2026-06-22',
  paid: false,
  fine_kind: 'handicap',
  created_by: me,
})
if (insErr) {
  console.log(`  ❌ ${insErr.message}`)
  console.log(`  ⇒ RLS 가 일반 회원의 INSERT 를 차단 중!`)
} else {
  console.log(`  ✓ 성공 (RLS 가 허용)`)
}

// round_scores INSERT 도 시도 (saveScores 의 main upsert)
console.log('\n▶ round_scores INSERT (안한순 본인) 시도:')
const { error: scErr } = await c.from('round_scores').upsert({
  club_id: MGF, user_id: HSAHN, year: 2026, month: 12,
  gross_score: 99, played_at: '2026-12-15',
}, { onConflict: 'club_id,user_id,year,month' })
console.log(`  ${scErr ? `❌ ${scErr.message}` : '✓ 성공'}`)

// 정리
await admin.from('finance_transactions').delete().eq('description', 'TEST 벌금')
await admin.from('round_scores').delete().eq('club_id', MGF).eq('user_id', HSAHN).eq('year', 2026).eq('month', 12)
await c.auth.signOut().catch(()=>{})
console.log('\n테스트 정리 완료')
