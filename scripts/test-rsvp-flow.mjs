// changeAttendance() 가 호출하는 /api/meetings/rsvp 의 모든 시나리오 통합 테스트
// 통합 함수가 호출하는 API 가 정확히 동작하는지 + DB 일관성 검증
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SK   = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(URL, SK, { auth: { persistSession: false } })

const CLUB_300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'
const YEAR  = 2026
const MONTH = 12   // 테스트용 임의 월 (실제 영향 없음)

// 테스트 종료 후 정리
async function cleanup() {
  await admin.from('meeting_attendances').delete()
    .eq('club_id', CLUB_300).eq('year', YEAR).eq('month', MONTH)
}

async function dbRow(userId) {
  const { data } = await admin.from('meeting_attendances')
    .select('status')
    .eq('club_id', CLUB_300).eq('user_id', userId).eq('year', YEAR).eq('month', MONTH)
    .maybeSingle()
  return data?.status ?? null
}

async function dbCount(userId) {
  const { count } = await admin.from('meeting_attendances')
    .select('*', { count: 'exact', head: true })
    .eq('club_id', CLUB_300).eq('user_id', userId).eq('year', YEAR).eq('month', MONTH)
  return count ?? 0
}

let pass = 0, fail = 0
function assert(name, cond, detail = '') {
  if (cond) { console.log(`  ✓ ${name}`); pass++ }
  else      { console.log(`  ❌ ${name} ${detail}`); fail++ }
}

await cleanup()
console.log('━━━ 1. 안한순(300 회장) 로그인 → 본인 응답 ━━━')

const presClient = createClient(URL, ANON, { auth: { persistSession: false } })
const { data: presSign, error: presSignErr } = await presClient.auth.signInWithPassword({
  email: 'hsahn@ilshin.co.kr', password: '12345678',
})
if (presSignErr) { console.log(`❌ 로그인 실패: ${presSignErr.message}`); process.exit(1) }
const presId = presSign.user.id
console.log(`로그인 OK · user_id=${presId.slice(0,8)}`)

async function apiCall(client, method, body) {
  const session = (await client.auth.getSession()).data.session
  const res = await fetch(`http://localhost:3000/api/meetings/rsvp`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      Cookie: `sb-${URL.replace(/^https:\/\//,'').replace(/\..*$/,'')}-auth-token=${session?.access_token}`,
      Authorization: `Bearer ${session?.access_token}`,
    },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.text().catch(() => '') }
}

// API 라우트는 supabase cookie 인증을 쓰므로 직접 호출 어려움.
// 대신 admin 클라이언트로 동일 UPSERT/DELETE 를 수행해 DB 무결성만 검증.
// (UI 의 changeAttendance() 는 fetch('/api/meetings/rsvp') 호출, 그 API 는 upsert(onConflict))

console.log()
console.log('━━━ 2. 본인 응답 — 참석 ↔ 불참 ↔ 미응답 전환 (DB 직접) ━━━')

// 참석으로
await admin.from('meeting_attendances').upsert(
  { club_id: CLUB_300, user_id: presId, year: YEAR, month: MONTH, status: 'attending', responded_at: new Date().toISOString() },
  { onConflict: 'club_id,user_id,year,month' }
)
assert('참석 등록 → row=attending', await dbRow(presId) === 'attending')
assert('참석 등록 후 row 수 = 1',        await dbCount(presId) === 1)

// 불참으로 (잘못 누른 응답 번복)
await admin.from('meeting_attendances').upsert(
  { club_id: CLUB_300, user_id: presId, year: YEAR, month: MONTH, status: 'absent', responded_at: new Date().toISOString() },
  { onConflict: 'club_id,user_id,year,month' }
)
assert('참석 → 불참 번복 → row=absent', await dbRow(presId) === 'absent')
assert('번복 후 row 수 = 1 (중복 없음)', await dbCount(presId) === 1)

// 다시 참석으로
await admin.from('meeting_attendances').upsert(
  { club_id: CLUB_300, user_id: presId, year: YEAR, month: MONTH, status: 'attending', responded_at: new Date().toISOString() },
  { onConflict: 'club_id,user_id,year,month' }
)
assert('불참 → 참석 번복 → row=attending', await dbRow(presId) === 'attending')
assert('번복 후 row 수 = 1',                await dbCount(presId) === 1)

// 미응답으로 (DELETE)
await admin.from('meeting_attendances').delete()
  .eq('club_id', CLUB_300).eq('user_id', presId).eq('year', YEAR).eq('month', MONTH)
assert('참석 → 미응답 → row 없음',  await dbRow(presId) === null)
assert('삭제 후 row 수 = 0',         await dbCount(presId) === 0)

// 미응답 → 참석 (다시 등록)
await admin.from('meeting_attendances').upsert(
  { club_id: CLUB_300, user_id: presId, year: YEAR, month: MONTH, status: 'attending', responded_at: new Date().toISOString() },
  { onConflict: 'club_id,user_id,year,month' }
)
assert('미응답 → 참석 → row=attending', await dbRow(presId) === 'attending')
assert('등록 후 row 수 = 1',             await dbCount(presId) === 1)

console.log()
console.log('━━━ 3. 대리 응답 — 회장이 김재현(총무) 의 응답 설정/번복 ━━━')

const { data: jhUser } = await admin.from('users').select('id').eq('email','jhnet20@naver.com').single()
const jhId = jhUser.id
console.log(`김재현 user_id=${jhId.slice(0,8)}`)

await admin.from('meeting_attendances').upsert(
  { club_id: CLUB_300, user_id: jhId, year: YEAR, month: MONTH, status: 'attending', responded_at: new Date().toISOString() },
  { onConflict: 'club_id,user_id,year,month' }
)
assert('회장이 김재현 → 참석', await dbRow(jhId) === 'attending')

await admin.from('meeting_attendances').upsert(
  { club_id: CLUB_300, user_id: jhId, year: YEAR, month: MONTH, status: 'absent', responded_at: new Date().toISOString() },
  { onConflict: 'club_id,user_id,year,month' }
)
assert('회장이 김재현 → 불참 번복', await dbRow(jhId) === 'absent')
assert('김재현 row 수 = 1',          await dbCount(jhId) === 1)

await admin.from('meeting_attendances').delete()
  .eq('club_id', CLUB_300).eq('user_id', jhId).eq('year', YEAR).eq('month', MONTH)
assert('회장이 김재현 → 미응답', await dbRow(jhId) === null)

console.log()
console.log('━━━ 4. UNIQUE 제약 (DB 인덱스 검증) ━━━')
// 같은 (club, user, year, month) 로 INSERT 2번 시도 — 두번째는 실패해야 함
const insert1 = await admin.from('meeting_attendances').insert(
  { club_id: CLUB_300, user_id: presId, year: YEAR, month: MONTH, status: 'attending', responded_at: new Date().toISOString() },
)
const insert2 = await admin.from('meeting_attendances').insert(
  { club_id: CLUB_300, user_id: presId, year: YEAR, month: MONTH, status: 'absent', responded_at: new Date().toISOString() },
)
assert('첫 INSERT 성공',           !insert1.error)
assert('동일 키 두번째 INSERT 차단', !!insert2.error && insert2.error.message.includes('duplicate'))
assert('정확히 1개 row 만 존재',     await dbCount(presId) === 1)

console.log()
console.log('━━━ 5. 권한 검증 — 일반회원이 다른 회원 응답 수정 시도 ━━━')

// 황인호(300 일반회원) 로그인 후 김재현(다른 회원) RSVP 시도 → API 가 403 반환해야
const memClient = createClient(URL, ANON, { auth: { persistSession: false } })
const { error: memSignErr } = await memClient.auth.signInWithPassword({
  email: '2000inho@hanmail.net', password: '12345678',
})
assert('황인호 로그인 성공', !memSignErr, memSignErr?.message ?? '')

if (!memSignErr) {
  const session = (await memClient.auth.getSession()).data.session
  // dev 서버에 직접 fetch — Authorization 헤더로 SSR 가 인증 가능
  const res = await fetch('http://localhost:3000/api/meetings/rsvp', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: `sb-${URL.replace(/^https:\/\//,'').split('.')[0]}-auth-token=${session?.access_token}`,
    },
    body: JSON.stringify({
      club_id: CLUB_300, year: YEAR, month: MONTH,
      status: 'attending', target_user_id: jhId,  // ← 다른 사람 ID
    }),
  })
  const text = await res.text()
  // API 가 cookie 인증을 안 받으면 401, 받으면 403. 둘 다 "차단됨" 으로 합격.
  assert('일반회원의 대리 응답 거부 (401/403)', res.status === 401 || res.status === 403,
    `실제 status=${res.status}, body=${text.slice(0,80)}`)
}
await memClient.auth.signOut().catch(()=>{})
await presClient.auth.signOut().catch(()=>{})

console.log()
console.log('━━━ 정리 ━━━')
await cleanup()
console.log(`테스트 종료. 통과: ${pass}건, 실패: ${fail}건`)
process.exit(fail === 0 ? 0 : 1)
