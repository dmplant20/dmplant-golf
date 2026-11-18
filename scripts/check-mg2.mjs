import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

// 실제 컬럼 정보 — meeting_guests 와 meeting_group_members
async function probe(table){
  const {error}=await a.from(table).select('*').limit(1)
  console.log(`${table}: ${error ? '❌ '+error.message : '✅'}`)
}
await probe('meeting_guests')
await probe('meeting_group_members')

// 실제 insert 시도
const {data:c}=await a.from('clubs').select('id').eq('name','MGF').single()
const {data:u}=await a.from('users').select('id').eq('full_name','최성복').single()
const {data:ins,error:insErr}=await a.from('meeting_guests').insert({
  club_id:c.id, year:2026, month:5,
  full_name:'테스트게스트',
  recommended_by:u.id,
}).select().single()
if(insErr){
  console.log('❌ insert 실패:', insErr.message, '| code:', insErr.code)
} else {
  console.log('✅ insert 성공 — 정리합니다')
  await a.from('meeting_guests').delete().eq('id', ins.id)
}
