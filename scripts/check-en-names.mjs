import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

// 영문 이름 누락된 회원 확인
const {data:users}=await a.from('users').select('id,full_name,full_name_en').order('full_name')
console.log('=== 영문 이름 누락 회원 ===')
users.forEach(u=>{
  if(!u.full_name_en || /[가-힣]/.test(u.full_name_en)){
    console.log(`  ${u.full_name?.padEnd(8)} ← full_name_en="${u.full_name_en ?? '(NULL)'}"`)
  }
})

// 게스트도 확인
const {data:guests}=await a.from('meeting_guests').select('id,full_name,full_name_en').gte('year',2026)
console.log('\n=== 게스트 영문 이름 ===')
guests.forEach(g=>{
  const flag = (!g.full_name_en || /[가-힣]/.test(g.full_name_en)) ? '❌' : '✅'
  console.log(`  ${flag} ${g.full_name?.padEnd(8)} ← full_name_en="${g.full_name_en ?? '(NULL)'}"`)
})
