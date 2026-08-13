import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'').trim()})
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const admin = createClient(URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

console.log('=== 1. 데이터 존재 여부 (service role — RLS 무시) ===')
const { data: clubs } = await admin.from('clubs').select('id, name')
for (const c of clubs ?? []) {
  const { count } = await admin.from('club_memberships').select('*', { count: 'exact', head: true }).eq('club_id', c.id)
  console.log(`  ${c.name}: ${count}명`)
}
const { data: lgs } = await admin.from('users').select('id, full_name, email').eq('full_name', '이규식')
console.log(`  이규식 users row: ${lgs?.length ? JSON.stringify(lgs[0]) : '❌ 없음'}`)
if (lgs?.[0]) {
  const { data: lgsMem } = await admin.from('club_memberships').select('club_id, role, status, clubs(name)').eq('user_id', lgs[0].id)
  lgsMem?.forEach(m => console.log(`  이규식 멤버십: ${m.clubs?.name} role=${m.role} status=${m.status}`))
}

console.log('\n=== 2. 일반 회원 눈으로 보이는지 (안한순 로그인 → RLS 적용) ===')
const c = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const { error: sErr } = await c.auth.signInWithPassword({ email: 'hsahn@ilshin.co.kr', password: '12345678' })
if (sErr) { console.log('로그인 실패:', sErr.message) } else {
  for (const c2 of clubs ?? []) {
    const { data: mem, error } = await c.from('club_memberships').select('user_id').eq('club_id', c2.id)
    console.log(`  ${c2.name} 멤버십 SELECT: ${error ? '❌ ' + error.message : (mem?.length ?? 0) + '건'}`)
  }
  const { data: us, error: uErr } = await c.from('users').select('id').limit(5)
  console.log(`  users SELECT: ${uErr ? '❌ ' + uErr.message : (us?.length ?? 0) + '건'}`)
  await c.auth.signOut().catch(()=>{})
}
