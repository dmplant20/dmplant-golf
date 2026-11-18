// /api/meetings/rsvp 가 회장의 대리 응답을 production 에서 정상 처리하는지 검증
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const DMPLANT = '78392f9f-c048-423f-8cf8-1ade740cc2f9'  // 최성복 (300 일반회원)
const CLUB300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'
const YEAR = 2026, MONTH = 11  // 테스트용

// 정리
await admin.from('meeting_attendances').delete().eq('club_id', CLUB300).eq('year', YEAR).eq('month', MONTH)

// 안한순(300 회장) 으로 로그인
const c = createClient(URL, ANON, { auth: { persistSession: false } })
const { data: signin, error: signErr } = await c.auth.signInWithPassword({ email: 'hsahn@ilshin.co.kr', password: '12345678' })
if (signErr) { console.log('❌ 로그인:', signErr.message); process.exit(1) }
console.log('✓ 안한순(300 회장) 로그인')

// production API 로 대리 응답 호출 — Authorization 헤더로 Bearer JWT
const token = signin.session.access_token
const prodUrl = 'https://dmplant-golf.vercel.app/api/meetings/rsvp'

console.log('\n▶ Production /api/meetings/rsvp 호출 (대리 응답)')
console.log(`  최성복(${DMPLANT.slice(0,8)}) 의 ${YEAR}-${MONTH} RSVP 를 attending 으로 회장이 대리 저장`)
const res = await fetch(prodUrl, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${token}`,
  },
  body: JSON.stringify({
    club_id: CLUB300, year: YEAR, month: MONTH,
    status: 'attending', target_user_id: DMPLANT,
  }),
})
const body = await res.text()
console.log(`  status=${res.status}  body=${body.slice(0,200)}`)

// DB 직접 확인
const { data: row } = await admin.from('meeting_attendances').select('*')
  .eq('club_id', CLUB300).eq('user_id', DMPLANT).eq('year', YEAR).eq('month', MONTH).maybeSingle()
if (row) console.log(`  ✓ DB 확인: ${row.status} (saved ${row.responded_at})`)
else console.log('  ❌ DB 에 행 없음 — API 가 저장 안 함')

// 정리
await admin.from('meeting_attendances').delete().eq('club_id', CLUB300).eq('year', YEAR).eq('month', MONTH)
await c.auth.signOut().catch(()=>{})
console.log('\n✓ 정리 완료')
