import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const {data:u}=await a.from('users').select('id,full_name').eq('email','dhlee8005@naver.com').single()
const {error}=await a.auth.admin.updateUserById(u.id, { password: '12345678' })
if(error){ console.error('❌',error.message); process.exit(1) }
await a.from('users').update({password_set:false}).eq('id',u.id)
console.log(`✓ ${u.full_name} 임시비번 → 12345678 (첫 로그인 시 변경 요청됨)`)
