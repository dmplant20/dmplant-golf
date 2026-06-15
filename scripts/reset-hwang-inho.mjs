// 황인호 비번 초기화 + 로그인 검증
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SK   = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const admin = createClient(URL, SK, { auth: { persistSession: false } })

const TARGET = {
  id:    'fef74da1-f16a-4fd1-a3ef-87e0436a4d63',
  name:  '황인호',
  email: '2000inho@hanmail.net',
}
const TEMP_PW = '12345678'

console.log(`━━━ ${TARGET.name} (${TARGET.email}) ━━━`)

// 1) auth.users 존재 확인
const { data: authUser, error: getErr } = await admin.auth.admin.getUserById(TARGET.id)
if (getErr || !authUser?.user) {
  console.log('  ❌ auth.users 에 없음 — 신규 생성')
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: TARGET.email,
    password: TEMP_PW,
    email_confirm: true,
    user_metadata: { full_name: TARGET.name },
  })
  if (cErr) {
    console.log(`  ❌ 생성 실패: ${cErr.message}`)
    process.exit(1)
  }
  console.log(`  ✓ auth 신규 생성: ${created.user.id}`)
} else {
  console.log('  ✓ auth.users 존재')
  console.log(`    email_confirmed_at: ${authUser.user.email_confirmed_at ?? '(미확인)'}`)
  console.log(`    last_sign_in_at   : ${authUser.user.last_sign_in_at ?? '(한 번도 로그인 안 함)'}`)
  console.log(`    banned_until      : ${authUser.user.banned_until ?? '-'}`)

  // 2) 비번 재설정 + 이메일 확인 강제
  const { error: uErr } = await admin.auth.admin.updateUserById(TARGET.id, {
    password: TEMP_PW,
    email_confirm: true,
  })
  if (uErr) {
    console.log(`  ❌ 재설정 실패: ${uErr.message}`)
    process.exit(1)
  }
  console.log(`  ✓ 비밀번호 재설정 완료 → ${TEMP_PW}`)
}

// 3) password_set=false 마킹 (첫 로그인 시 본인이 새 비번 설정)
const { error: pErr } = await admin.from('users').update({ password_set: false }).eq('id', TARGET.id)
if (pErr) console.log(`  ⚠ password_set 마킹 경고: ${pErr.message}`)
else console.log(`  ✓ password_set=false (첫 로그인 시 비번 변경 팝업)`)

// 4) 로그인 검증 — anon 키로 실제 로그인 시도
await new Promise(r => setTimeout(r, 600))
const client = createClient(URL, ANON, { auth: { persistSession: false } })
const { data: signin, error: signErr } = await client.auth.signInWithPassword({
  email: TARGET.email, password: TEMP_PW,
})
if (signErr) {
  console.log(`  ❌ 로그인 검증 실패: ${signErr.message}`)
} else {
  console.log(`  ✓ 로그인 검증 성공 — user_id=${signin.user.id.slice(0,8)}`)
}
await client.auth.signOut().catch(()=>{})

console.log()
console.log('=== 완료 ===')
console.log(`이름        : ${TARGET.name}`)
console.log(`이메일      : ${TARGET.email}`)
console.log(`임시 비밀번호: ${TEMP_PW}`)
console.log(`첫 로그인 후 본인이 새 비밀번호를 설정합니다.`)
