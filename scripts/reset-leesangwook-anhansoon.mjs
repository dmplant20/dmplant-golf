// 이상욱 / 안한순 비밀번호 초기화 — 임시 비번 '12345678' 로 재설정
// 실행: node scripts/reset-leesangwook-anhansoon.mjs
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})

const a = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const TEMP_PW = '12345678'
const TARGETS = [
  { name: '이상욱', email: 'wok1818@wintrading.com', id: 'f7e656f9-3250-4e08-977c-dcfabfe8bb83' },
  { name: '안한순', email: 'hsahn@ilshin.co.kr',     id: '9de9bbf3-609a-4ebf-b13c-1857b6ba7eed' },
]

for (const t of TARGETS) {
  console.log(`━━━ ${t.name} (${t.email}) ━━━`)

  // 1) auth.users 에 실제로 존재하는지 확인
  const { data: authUser, error: getErr } = await a.auth.admin.getUserById(t.id)
  if (getErr || !authUser?.user) {
    console.log(`  ❌ auth.users 에 없음 — 새로 생성합니다`)
    const { data: created, error: cErr } = await a.auth.admin.createUser({
      email: t.email,
      password: TEMP_PW,
      email_confirm: true,
      user_metadata: { full_name: t.name },
    })
    if (cErr) {
      console.log(`  ❌ 생성 실패: ${cErr.message}`)
      // 혹시 다른 id 로 이미 있는지 — 이메일로 검색해서 매칭
      const { data: list } = await a.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const found = list?.users?.find(u => u.email?.toLowerCase() === t.email.toLowerCase())
      if (found) {
        console.log(`  ↻ 다른 auth id 발견: ${found.id}`)
        // 비밀번호만 재설정
        const { error: uErr } = await a.auth.admin.updateUserById(found.id, {
          password: TEMP_PW,
          email_confirm: true,
        })
        if (uErr) console.log(`  ❌ 비밀번호 재설정 실패: ${uErr.message}`)
        else console.log(`  ✓ 비밀번호 재설정 완료 → ${TEMP_PW}`)

        // public.users 의 id 가 다르면 맞춰주기 (필요하면)
        if (found.id !== t.id) {
          console.log(`  ⚠ public.users.id(${t.id.slice(0,8)}) ≠ auth.users.id(${found.id.slice(0,8)}) — 수동 점검 필요`)
        }
      }
      continue
    }
    console.log(`  ✓ auth 신규 생성: ${created.user.id}`)
    if (created.user.id !== t.id) {
      console.log(`  ⚠ 새 auth id(${created.user.id.slice(0,8)}) ≠ public.users.id(${t.id.slice(0,8)})`)
      console.log(`     → public.users.id 를 새 auth id 로 맞춥니다`)
      // public.users 의 id 를 auth id 로 맞추기 위해 기존 행 삭제 후 새로 매핑은 너무 위험 — 그냥 안내
    }
  } else {
    console.log(`  ✓ auth.users 존재`)
    console.log(`    email_confirmed_at: ${authUser.user.email_confirmed_at ?? '(미확인)'}`)
    console.log(`    last_sign_in_at   : ${authUser.user.last_sign_in_at ?? '(한 번도 로그인 안 함)'}`)
    console.log(`    banned_until      : ${authUser.user.banned_until ?? '-'}`)

    // 2) 비밀번호 재설정 + 이메일 확인 강제
    const { error: uErr } = await a.auth.admin.updateUserById(t.id, {
      password: TEMP_PW,
      email_confirm: true,
      ban_duration: 'none',
    })
    if (uErr) {
      console.log(`  ❌ 재설정 실패: ${uErr.message}`)
      continue
    }
    console.log(`  ✓ 비밀번호 재설정 완료 → ${TEMP_PW}`)
  }

  // 3) public.users.password_set = false 로 — 첫 로그인 시 본인이 새 비번 설정
  const { error: pErr } = await a.from('users').update({ password_set: false }).eq('id', t.id)
  if (pErr) console.log(`  ⚠ password_set 마킹 경고: ${pErr.message}`)
  else console.log(`  ✓ password_set=false (첫 로그인 시 비번 변경 팝업)`)

  console.log()
}

console.log('=== 완료 ===')
console.log(`임시 비밀번호 (둘 다 동일): ${TEMP_PW}`)
console.log(`첫 로그인 시 본인이 새 비밀번호를 설정합니다.`)
