// 1) users.password_set 컬럼 추가 (이미 있으면 스킵)
// 2) 방금 등록된 MGF 회원 27명을 password_set=false 로 마킹
//    (placeholder 이메일 + 명시 이메일 리스트)
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

fs.readFileSync('.env.local','utf8').split('\n').forEach(l => {
  const m = l.match(/^([A-Z_]+)=(.*)$/); if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } })

// 방금 등록된 MGF 회원 이메일
const EMAILS = [
  'wok1818@wintrading.com', 'hykim@wintrading.co.kr', '0524sang@gmail.com',
  'jhnet20@naver.com', 'k01036012693@gmail.com', 'sang2442@wintrading.co.kr',
  'polybagsa@naver.com', 'ojh4824@gmail.com', 'simonk@unisollvina.com',
  'cspark@yckorea.com', 'joseph010328@gmail.com', 'djbaik@dsvina.com.vn',
  'j2652@hwashintnp.com', 'hsahn@ilshin.co.kr', 'llkjhgf62@daum.net',
  'baesangju275@gmail.com', 'jasonyg@hanmail.net', 'leesuntex@naver.com',
  '67water@naver.com', 'S01050985440@gmail.com', 'design932@gmail.com',
  'taupe1@wintrading.co.kr', 'edwardlee@wintrading.co.kr',
]

async function ensureColumn() {
  // RPC 가 없으면 SQL Editor 에서 실행해야 함 — 여기서는 update 시도해서 컬럼 존재 여부 확인
  const { data, error } = await a.from('users').select('password_set').limit(1)
  if (error && error.message.includes('column')) {
    console.error('❌ users.password_set 컬럼 없음 — Supabase SQL Editor 에서 다음 실행:')
    console.error("   ALTER TABLE users ADD COLUMN IF NOT EXISTS password_set boolean DEFAULT true NOT NULL;")
    return false
  }
  console.log('✓ password_set 컬럼 존재')
  return true
}

async function markMembers() {
  // 1. placeholder 이메일들
  const { data: phRows, error: phErr } = await a.from('users')
    .update({ password_set: false }).like('email', 'placeholder_%@mgf.local').select('email')
  if (phErr) { console.error('placeholder update 실패:', phErr.message); return }
  console.log(`✓ placeholder 회원 ${phRows?.length ?? 0}명 → password_set=false`)

  // 2. 명시 이메일들 (300회 등 다른 클럽에 이미 가입된 회원은 password_set=true 유지하기 위해 별도 체크 필요)
  // 우선 전부 false 로 (방금 만든 신규 가입이라 안전). 만약 김재헌·이영규·안한순·전하영 처럼
  // 이전에 이미 비밀번호 설정한 사용자가 있으면 별도 보정 필요.
  const { data: emRows, error: emErr } = await a.from('users')
    .update({ password_set: false }).in('email', EMAILS).select('email,password_set')
  if (emErr) { console.error('명시 이메일 update 실패:', emErr.message); return }
  console.log(`✓ 명시 이메일 ${emRows?.length ?? 0}명 → password_set=false`)
  emRows?.forEach(r => console.log('  -', r.email))
}

async function main() {
  if (!(await ensureColumn())) process.exit(1)
  await markMembers()
  // 결과 확인
  const { count: total } = await a.from('users').select('*', { count: 'exact', head: true }).eq('password_set', false)
  console.log(`\n📊 전체 password_set=false 사용자 수: ${total}`)
}

main().catch(e => { console.error('💥', e); process.exit(1) })
