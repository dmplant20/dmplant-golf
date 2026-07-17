import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

// meeting_guests 테이블 존재 여부 — 첫 행 시도
const {data,error,count}=await a.from('meeting_guests').select('*',{count:'exact',head:true})
if(error){
  console.log('❌ meeting_guests 테이블 미존재')
  console.log('   에러:', error.message, '/ code:', error.code)
} else {
  console.log(`✅ meeting_guests 테이블 존재 — 현재 ${count}건`)
}

// meeting_group_members 의 guest_id 컬럼 존재 여부
const {error:colErr}=await a.from('meeting_group_members').select('guest_id').limit(1)
if(colErr){ console.log('❌ meeting_group_members.guest_id 컬럼 미존재:', colErr.message) }
else { console.log('✅ meeting_group_members.guest_id 컬럼 존재') }
