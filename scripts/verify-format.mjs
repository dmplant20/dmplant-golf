import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

// MGF 멤버만 보기
const {data:c}=await a.from('clubs').select('id').eq('name','MGF').single()
const {data:mems}=await a.from('club_memberships')
  .select('users(full_name,full_name_en)')
  .eq('club_id',c.id).eq('status','approved')
  .order('users(full_name)')

console.log('=== MGF 회원 영문명 (정규화 후) ===')
mems.forEach(m=>{
  const u=m.users
  console.log(`  ${(u?.full_name??'').padEnd(8)} → ${u?.full_name_en ?? '(NULL)'}`)
})

// dmplant@gmail.com 이상한 행 정리
const {data:bad}=await a.from('users')
  .select('id,full_name,full_name_en')
  .eq('full_name_en','Dmplant@gmail.com').maybeSingle()
if(bad){
  await a.from('users').update({full_name_en:null}).eq('id',bad.id)
  console.log(`\n✓ 잘못된 행 정리: ${bad.full_name} full_name_en → NULL`)
}
