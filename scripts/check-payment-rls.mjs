// club_payment_info RLS 정책 점검 + 일반 회원 시뮬레이션
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SK       = process.env.SUPABASE_SERVICE_ROLE_KEY
const admin = createClient(SUPA_URL, SK, { auth: { persistSession: false } })

// 1) pg_policies 조회 — REST API 로
console.log('▶ club_payment_info RLS 정책:')
const r = await fetch(`${SUPA_URL}/rest/v1/rpc/postgres_query`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json', apikey: SK, Authorization: `Bearer ${SK}` },
  body: JSON.stringify({ query: `SELECT policyname,cmd,qual::text,with_check::text FROM pg_policies WHERE tablename='club_payment_info'` })
}).catch(e => null)
if (r && r.ok) console.log(await r.json())
else console.log('  (postgres_query RPC 없음 — 마이그레이션 파일에서 확인)\n')

// 2) 일반 회원으로 직접 로그인해서 SELECT 테스트
// MGF 일반 회원 한 명 골라서 — 김재헌 (jhnet20@naver.com) 으로 시뮬레이션
console.log('▶ 일반 회원(이태화 또는 김재헌)으로 magic link signin 후 RLS 테스트는 복잡')
console.log('  → 직접 anon 으로 RLS 우회 가능한지만 확인')

// 임의 회원의 JWT 를 admin 으로 생성해서 그 사람 권한으로 query
const { data: { user: me } } = await admin.auth.admin.getUserById('a5d0274a-???').catch(() => ({data:{user:null}}))

// 김재헌 user id 찾기
const { data: jhuser } = await admin.from('users').select('id,email').eq('email','jhnet20@naver.com').maybeSingle()
console.log('\n▶ 김재헌 (일반 회원) id:', jhuser?.id ?? '(없음)')

if (jhuser) {
  // 일반회원 JWT 발급 — generateLink 로 access token 받기
  const { data: link, error: linkErr } = await admin.auth.admin.generateLink({
    type: 'magiclink', email: 'jhnet20@naver.com',
  })
  if (linkErr) console.log('  ❌ magic link 발급 실패:', linkErr.message)
  else {
    // hash_token 으로 직접 access_token 얻기 어려움 → 다른 방식
    // 대신 admin client 에 user_id impersonate 헤더 시도
    console.log('  (impersonation 어려움 — 대신 anon 으로 club_payment_info SELECT)')
  }
}

// 3) anon (로그인 X) 으로 SELECT — RLS 가 있으면 0 행, RLS 없거나 anon 허용이면 N 행
const anon = createClient(SUPA_URL, ANON, { auth: { persistSession: false } })
const { data: anonRows, error: anonErr } = await anon.from('club_payment_info').select('*')
console.log('\n▶ anon (비로그인) SELECT 결과:')
if (anonErr) console.log('  ❌', anonErr.message)
else console.log(`  ${anonRows?.length ?? 0}개 행 (RLS 가 anon 차단 중)`)

// 4) club_memberships 안에서 회원이 본인 클럽의 payment info 를 볼 수 있어야 함
// 정책 명세 추측: club_payment_info SELECT 는 'auth.uid() IN (해당 클럽 멤버)' 이어야 함
// RLS 가 너무 엄격하면 일반 회원이 못 봄. 정책 확인하려면 마이그레이션 파일 봐야 함.

// 5) 다른 클럽도 점검
console.log('\n▶ 모든 club_payment_info 행 (service-role):')
const { data: allPi } = await admin.from('club_payment_info').select('club_id,bank_name,bank_account,bank_holder,qr_image_url,updated_at')
const { data: clubs } = await admin.from('clubs').select('id,name')
allPi?.forEach(p => {
  const c = clubs?.find(x => x.id === p.club_id)
  console.log(`  ${c?.name?.padEnd(10) ?? '?'}  ${p.bank_name ?? '(empty)'}  ${p.bank_account ?? ''}  @${p.updated_at?.slice(0,10)}`)
})

// 6) MGF 클럽 회원들의 currentClubId 가 어떻게 저장되어 있는지 — users.last_active_club_id?
console.log('\n▶ users 테이블 컬럼 확인:')
const { data: cols } = await admin.from('users').select('*').limit(1)
if (cols && cols[0]) console.log('  컬럼들:', Object.keys(cols[0]).join(', '))
