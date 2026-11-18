import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})

const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const SK   = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY

const admin = createClient(URL, SK, { auth: { persistSession: false } })

// 안한순 비번 재설정 + 명시적으로 password_set=true 도 함께
const { error: uErr } = await admin.auth.admin.updateUserById(
  '9de9bbf3-609a-4ebf-b13c-1857b6ba7eed',
  { password: '12345678', email_confirm: true },
)
console.log('비번 재설정:', uErr?.message ?? 'OK')

// 잠깐 대기
await new Promise(r => setTimeout(r, 800))

const client = createClient(URL, ANON, { auth: { persistSession: false } })
const { data, error } = await client.auth.signInWithPassword({
  email: 'hsahn@ilshin.co.kr',
  password: '12345678',
})
console.log('로그인:', error?.message ?? `✓ ${data?.user?.email}`)

if (data?.user) {
  // RLS 통과 테스트
  const { data: pi, error: piErr } = await client.from('club_payment_info').select('*')
  if (piErr) {
    console.log('❌ SELECT 에러:', piErr.message)
  } else {
    console.log(`✓ SELECT 성공 — ${pi.length}개 행`)
    pi.forEach(p => console.log(`  bank=${p.bank_name} | acct=${p.bank_account} | holder=${p.bank_holder}`))
  }

  // 멤버십도 확인
  const { data: mems } = await client.from('club_memberships').select('club_id,role,status,clubs(name)').eq('user_id', data.user.id)
  console.log('  멤버십:', mems?.map(m => `${m.clubs?.name}:${m.role}/${m.status}`).join(', '))
}
await client.auth.signOut().catch(()=>{})
