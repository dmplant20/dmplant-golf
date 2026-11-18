// 일반 회원으로 직접 로그인 → club_payment_info SELECT 가능한지 확인
// 안한순 (방금 비번 리셋한 일반 회원) 계정 사용
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

// 일반 회원으로 로그인 (anon 키 + signInWithPassword)
const client = createClient(SUPA_URL, ANON, { auth: { persistSession: false } })
const { data: auth, error: authErr } = await client.auth.signInWithPassword({
  email: 'hsahn@ilshin.co.kr',  // 안한순
  password: '12345678',
})
if (authErr) { console.log('❌ 로그인 실패:', authErr.message); process.exit(1) }
console.log('✓ 안한순 로그인 성공 — user_id:', auth.user.id.slice(0,8))
console.log('  email:', auth.user.email)
console.log()

// 1) club_memberships 자기 클럽 확인
const { data: mems, error: mErr } = await client.from('club_memberships')
  .select('club_id, role, status, clubs(name)')
  .eq('user_id', auth.user.id)
if (mErr) console.log('  ❌ memberships:', mErr.message)
else {
  console.log('▶ 안한순 멤버십:')
  mems?.forEach(m => console.log(`  ${m.clubs?.name}  ${m.role}  ${m.status}  (club_id=${m.club_id.slice(0,8)})`))
}
console.log()

// 2) club_payment_info SELECT — RLS 통과해서 MGF 행 나와야 정상
const { data: pi, error: piErr } = await client.from('club_payment_info').select('*')
console.log('▶ 일반 회원 club_payment_info SELECT 결과:')
if (piErr) {
  console.log('  ❌ 에러:', piErr.message)
} else {
  console.log(`  ${pi?.length ?? 0}개 행 반환`)
  pi?.forEach(p => {
    console.log(`    club_id=${p.club_id.slice(0,8)}  bank=${p.bank_name}  account=${p.bank_account}  holder=${p.bank_holder}`)
  })
  if ((pi?.length ?? 0) === 0) {
    console.log('  ❌ RLS 가 일반 회원의 SELECT 를 차단 중!')
    console.log('     마이그레이션 SQL 이 실제로 적용 안 됐을 가능성')
  } else {
    console.log('  ✓ RLS 정상 통과')
  }
}

// 3) 특정 club_id 로 다시 시도
console.log()
console.log('▶ club_id 명시해서 SELECT (MGF=0b9b3498):')
const mgfId = '0b9b3498-' // 부분 매칭 안 됨, 전체 id 가져오기
const mgfMem = mems?.find(m => m.clubs?.name === 'MGF')
if (mgfMem) {
  const { data: piMgf, error: piMgfErr } = await client.from('club_payment_info')
    .select('*').eq('club_id', mgfMem.club_id).maybeSingle()
  if (piMgfErr) console.log('  ❌', piMgfErr.message)
  else if (!piMgf) console.log('  ⚠ MGF 행이 안 반환됨 — RLS 차단')
  else console.log('  ✓', piMgf.bank_name, piMgf.bank_account, piMgf.bank_holder)
} else {
  console.log('  안한순은 MGF 멤버 아님')
}

await client.auth.signOut()
