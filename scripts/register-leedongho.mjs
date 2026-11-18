import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const MEMBER = {
  name:     '이동호',
  en:       'Lee Dongho',
  email:    'dhlee8005@naver.com',
  role:     'member',
  fee_type: 'monthly',   // 기본 월회비 — 총무가 나중에 조정 가능
}
const tempPw = '12345678'   // 모든 신규 회원 공통 — 첫 로그인 시 본인이 변경

const {data:club}=await a.from('clubs').select('id,name').eq('name','MGF').single()
console.log('▶ MGF 클럽:', club.id.slice(0,8))

// 1) 이미 등록된 이메일인지 확인
let { data: existingUser } = await a.from('users').select('id,full_name,email,password_set').eq('email', MEMBER.email).maybeSingle()
let userId, isNew=false

if(existingUser){
  userId = existingUser.id
  console.log('↻ 기존 user 재사용 —', existingUser.full_name, '(', userId.slice(0,8), ')')
} else {
  // 2) auth 사용자 생성
  const { data: created, error: authErr } = await a.auth.admin.createUser({
    email: MEMBER.email,
    password: tempPw,
    email_confirm: true,
    user_metadata: { full_name: MEMBER.name },
  })
  if(authErr){ console.error('❌ auth 생성 실패:', authErr.message); process.exit(1) }
  userId = created.user.id
  isNew = true
  console.log('✓ 신규 auth 생성:', userId.slice(0,8))
}

// 3) public.users 갱신 (이름·영문명 등)
const userUpdates = {
  full_name:    MEMBER.name,
  full_name_en: MEMBER.en,
}
if(isNew) userUpdates.password_set = false
const { error: uErr } = await a.from('users').update(userUpdates).eq('id', userId)
if(uErr) console.warn('⚠ users update 경고:', uErr.message)
else console.log('✓ users 정보 갱신')

// 4) club_memberships — MGF 정회원 등록
const { data: existingMem } = await a.from('club_memberships')
  .select('id, status, role').eq('club_id', club.id).eq('user_id', userId).maybeSingle()

if(existingMem){
  const { error: mErr } = await a.from('club_memberships').update({
    role:     MEMBER.role,
    status:   'approved',
    fee_type: MEMBER.fee_type,
    joined_at: new Date().toISOString(),
  }).eq('id', existingMem.id)
  if(mErr){ console.error('❌ membership update:', mErr.message); process.exit(1) }
  console.log('✓ 기존 MGF 멤버십 갱신: approved + monthly')
} else {
  const { error: mErr } = await a.from('club_memberships').insert({
    club_id:   club.id,
    user_id:   userId,
    role:      MEMBER.role,
    status:    'approved',
    fee_type:  MEMBER.fee_type,
    joined_at: new Date().toISOString(),
  })
  if(mErr){ console.error('❌ membership insert:', mErr.message); process.exit(1) }
  console.log('✓ 신규 MGF 멤버십 등록')
}

console.log('\n=== 등록 완료 ===')
console.log(`이름        : ${MEMBER.name} (${MEMBER.en})`)
console.log(`이메일      : ${MEMBER.email}`)
console.log(`클럽        : MGF`)
console.log(`역할/상태   : ${MEMBER.role} / approved`)
console.log(`회비 종류   : ${MEMBER.fee_type} (총무가 변경 가능)`)
if(isNew){
  console.log(`임시 비번   : ${tempPw}`)
  console.log(`첫 로그인 시 본인이 새 비밀번호 설정`)
}
