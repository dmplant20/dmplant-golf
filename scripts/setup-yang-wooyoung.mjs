// 양우영 회원 이메일/비번 설정 + 로그인 검증
// 기존 placeholder 이메일이 있었으면 실제 이메일로 갱신
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SK   = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const admin = createClient(URL, SK, { auth: { persistSession: false } })

const TARGET = {
  name:  '양우영',
  en:    'Yang Wooyoung',
  email: 'wyyang@sn-logistics.com',
}
const PASSWORD = 'w1231234'

console.log(`━━━ ${TARGET.name} 설정 ━━━`)

// 1) public.users 에 이름으로 검색 (placeholder 이메일로 등록되어 있을 가능성)
console.log('\n1) public.users 검색:')
const { data: byName } = await admin.from('users').select('id,email,full_name,full_name_en,password_set,created_at').eq('full_name', TARGET.name)
let userId = null
let existing = null
if (byName && byName.length > 0) {
  existing = byName[0]
  userId = existing.id
  console.log(`  ✓ 발견 — id=${userId.slice(0,8)}, 현재 email=${existing.email}`)
} else {
  console.log('  · 이름으로 못 찾음')
}

// 2) 새 이메일로도 검색 (혹시 이미 새 이메일로 가입돼있나)
console.log('\n2) 새 이메일로 검색:')
const { data: byEmail } = await admin.from('users').select('id,email,full_name').eq('email', TARGET.email).maybeSingle()
if (byEmail) {
  console.log(`  ✓ 이미 새 이메일로 가입됨 — ${byEmail.full_name} (id=${byEmail.id.slice(0,8)})`)
  if (userId && userId !== byEmail.id) {
    console.log(`  ⚠ 같은 사람이 두 user_id 로 존재 가능 — 새 이메일 user 를 우선 사용`)
    userId = byEmail.id
  } else if (!userId) {
    userId = byEmail.id
    existing = byEmail
  }
} else {
  console.log('  · 새 이메일로 등록된 사용자 없음')
}

// 3) auth 사용자 처리
if (userId) {
  console.log('\n3) auth.users 업데이트:')
  // 기존 user 가 있으면 — 이메일 + 비번 동시 갱신
  const { data: authBefore } = await admin.auth.admin.getUserById(userId)
  if (authBefore?.user) {
    console.log(`  현재 auth email: ${authBefore.user.email}`)
    const { error: uErr } = await admin.auth.admin.updateUserById(userId, {
      email: TARGET.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: TARGET.name },
    })
    if (uErr) {
      console.log(`  ❌ auth 업데이트 실패: ${uErr.message}`)
      process.exit(1)
    }
    console.log(`  ✓ auth 이메일 → ${TARGET.email}, 비번 → ${PASSWORD}`)
  } else {
    console.log(`  ❌ public.users 행은 있는데 auth.users 에 없음 — 신규 생성 시도`)
    const { data: created, error: cErr } = await admin.auth.admin.createUser({
      email: TARGET.email,
      password: PASSWORD,
      email_confirm: true,
      user_metadata: { full_name: TARGET.name },
    })
    if (cErr) { console.log(`  ❌ 생성 실패: ${cErr.message}`); process.exit(1) }
    userId = created.user.id
    console.log(`  ✓ 신규 auth: ${userId}`)
  }
} else {
  console.log('\n3) 신규 auth 사용자 생성:')
  const { data: created, error: cErr } = await admin.auth.admin.createUser({
    email: TARGET.email,
    password: PASSWORD,
    email_confirm: true,
    user_metadata: { full_name: TARGET.name },
  })
  if (cErr) { console.log(`  ❌ 생성 실패: ${cErr.message}`); process.exit(1) }
  userId = created.user.id
  console.log(`  ✓ 신규 auth: ${userId}`)
}

// 4) public.users 갱신 — 이메일 / 이름 / password_set
console.log('\n4) public.users 갱신:')
const updates = {
  email: TARGET.email,
  full_name: TARGET.name,
  full_name_en: TARGET.en,
  password_set: true,  // 사용자가 명시적으로 지정한 비번이므로 true
}
const { error: pErr } = await admin.from('users').update(updates).eq('id', userId)
if (pErr) console.log(`  ⚠ users 갱신 경고: ${pErr.message}`)
else console.log(`  ✓ email=${TARGET.email}, full_name=${TARGET.name}, full_name_en=${TARGET.en}, password_set=true`)

// 5) 멤버십 확인
console.log('\n5) 클럽 멤버십:')
const { data: mems } = await admin.from('club_memberships')
  .select('role,status,fee_type,clubs(id,name)').eq('user_id', userId)
mems?.forEach(m => console.log(`  ${m.clubs.name}  ${m.role}  ${m.status}  fee=${m.fee_type ?? '-'}`))

// 양우영은 MGF yellow=true (pending) 으로 등록되어 있을 것 — 활성화 필요할지 사용자에게 물어봐야 함.
// 일단 자동 활성화하지 않고 상태만 보고.

// 6) 실제 로그인 검증
console.log('\n6) 로그인 검증:')
await new Promise(r => setTimeout(r, 600))
const client = createClient(URL, ANON, { auth: { persistSession: false } })
const { data: signin, error: signErr } = await client.auth.signInWithPassword({
  email: TARGET.email, password: PASSWORD,
})
if (signErr) console.log(`  ❌ 로그인 실패: ${signErr.message}`)
else console.log(`  ✓ 로그인 성공 — user_id=${signin.user.id.slice(0,8)}`)
await client.auth.signOut().catch(()=>{})

console.log('\n=== 완료 ===')
console.log(`이름     : ${TARGET.name} (${TARGET.en})`)
console.log(`이메일   : ${TARGET.email}`)
console.log(`비밀번호 : ${PASSWORD}`)
