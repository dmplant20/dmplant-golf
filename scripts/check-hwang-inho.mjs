import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data: club } = await a.from('clubs').select('id,name').eq('name','300').single()
console.log('▶ 300 클럽:', club.id, '\n')

// 1) 이름 정확히 황인호
console.log('▶ "황인호" 이름 검색:')
const { data: byName } = await a.from('users').select('id,email,full_name,full_name_en,password_set,created_at').eq('full_name','황인호')
if (!byName || byName.length === 0) {
  console.log('  ❌ 정확히 일치하는 "황인호" 없음')
} else {
  for (const u of byName) {
    console.log(`  id=${u.id}`)
    console.log(`  email=${u.email}`)
    console.log(`  full_name=${u.full_name}  full_name_en=${u.full_name_en}`)
    console.log(`  password_set=${u.password_set}`)
    console.log(`  created_at=${u.created_at}`)
    const { data: mem } = await a.from('club_memberships').select('role,status,fee_type,joined_at,clubs(name)').eq('user_id', u.id)
    console.log('  멤버십:', mem)
  }
}

// 2) 부분 매치 (성씨 다를 수도)
console.log('\n▶ "인호" 포함 검색:')
const { data: partial } = await a.from('users').select('id,email,full_name,full_name_en').ilike('full_name','%인호%')
partial?.forEach(u => console.log(`  ${u.full_name} (${u.full_name_en}) | ${u.email} | id=${u.id.slice(0,8)}`))

// 3) 영문명 hwang/inho 포함
console.log('\n▶ 영문명 Hwang/Inho 검색:')
const { data: en } = await a.from('users').select('id,email,full_name,full_name_en').or('full_name_en.ilike.%hwang%,full_name_en.ilike.%inho%,full_name_en.ilike.%in-ho%,full_name_en.ilike.%in ho%')
en?.forEach(u => console.log(`  ${u.full_name} (${u.full_name_en}) | ${u.email} | id=${u.id.slice(0,8)}`))

// 4) 300 클럽 모든 회원
console.log('\n▶ 300 클럽 전체 회원 명단:')
const { data: all300 } = await a.from('club_memberships')
  .select('role, status, users(id,email,full_name,full_name_en,password_set)')
  .eq('club_id', club.id)
  .order('role')
all300?.forEach(m => {
  const u = m.users
  console.log(`  ${m.role.padEnd(11)} ${m.status.padEnd(8)} ${u.full_name.padEnd(6)} ${(u.full_name_en ?? '').padEnd(20)} ${u.email}  ${u.password_set ? '' : '(미로그인)'}`)
})
