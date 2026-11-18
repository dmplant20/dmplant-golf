// 이상욱 / 안한순 계정 상태 점검
// 실행: node scripts/check-leesangwook-anhansoon.mjs
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})

const a = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { persistSession: false } },
)

const TARGETS = [
  { name: '이상욱', candidates: ['wok1818@wintrading.com', 'wok1818@wintrading.co.kr'] },
  { name: '안한순', candidates: ['hsahn@ilshin.co.kr', 'hsahn@ilshin.com'] },
]

// MGF 클럽 확인
const { data: club } = await a.from('clubs').select('id,name').eq('name','MGF').single()
console.log('▶ MGF 클럽:', club.id.slice(0,8), '\n')

for (const t of TARGETS) {
  console.log(`━━━ ${t.name} ━━━`)

  // 1) 이름으로 public.users 검색
  const { data: byName } = await a.from('users').select('id,email,full_name,full_name_en,password_set,created_at')
    .eq('full_name', t.name)
  if (!byName || byName.length === 0) {
    console.log(`  ❌ public.users 에 "${t.name}" 이름 없음`)
  } else {
    for (const u of byName) {
      console.log(`  public.users:`)
      console.log(`    id           : ${u.id}`)
      console.log(`    email        : ${u.email}`)
      console.log(`    full_name    : ${u.full_name}`)
      console.log(`    full_name_en : ${u.full_name_en}`)
      console.log(`    password_set : ${u.password_set}`)
      console.log(`    created_at   : ${u.created_at}`)
      // 멤버십 확인
      const { data: mem } = await a.from('club_memberships')
        .select('role,status,fee_type,joined_at')
        .eq('club_id', club.id).eq('user_id', u.id).maybeSingle()
      if (mem) {
        console.log(`    멤버십       : role=${mem.role} status=${mem.status} fee=${mem.fee_type}`)
      } else {
        console.log(`    멤버십       : ❌ MGF 멤버십 없음`)
      }
    }
  }

  // 2) 후보 이메일 각각으로 auth 검색
  for (const email of t.candidates) {
    const { data: byEmail } = await a.from('users').select('id,email,password_set').eq('email', email).maybeSingle()
    if (byEmail) {
      console.log(`  ✓ users 테이블에 '${email}' 존재 (id=${byEmail.id.slice(0,8)})`)
    } else {
      console.log(`  · '${email}' → 없음`)
    }
    // auth.users 직접 확인 (admin API 로 list)
  }

  // 3) auth.users 에서 직접 조회 (admin)
  for (const email of t.candidates) {
    const { data: authList, error } = await a.auth.admin.listUsers({ page: 1, perPage: 1, filter: `email.eq.${email}` })
    if (error) { console.log(`  auth list 에러 (${email}):`, error.message); continue }
    const found = authList?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase())
    if (found) {
      console.log(`  ✓ auth.users '${email}' 존재`)
      console.log(`    auth id           : ${found.id}`)
      console.log(`    email_confirmed_at: ${found.email_confirmed_at}`)
      console.log(`    last_sign_in_at   : ${found.last_sign_in_at ?? '(한 번도 로그인 안 함)'}`)
      console.log(`    banned_until      : ${found.banned_until ?? '-'}`)
    }
  }
  console.log()
}

// 추가: 부분 검색
console.log('━━━ 추가 점검: wok1818 / hsahn 부분 검색 ━━━')
const { data: partial } = await a.from('users').select('id,email,full_name').or('email.ilike.%wok1818%,email.ilike.%hsahn%,email.ilike.%ilshin%,email.ilike.%wintrading%')
partial?.forEach(u => console.log(`  ${u.full_name} | ${u.email} | id=${u.id.slice(0,8)}`))
