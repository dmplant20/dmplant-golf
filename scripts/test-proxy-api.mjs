import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const {data:c}=await a.from('clubs').select('id').eq('name','MGF').single()
const {data:pres}=await a.from('users').select('id,full_name').eq('full_name','최성복').single()
const {data:target}=await a.from('users').select('id,full_name').eq('full_name','박창수').single()

console.log('회장:', pres)
console.log('타겟:', target)

// 직접 service-role 클라이언트로 upsert 해보기 (API 의 내부 로직과 동일)
const {error}=await a.from('meeting_attendances').upsert(
  { club_id: c.id, year: 2026, month: 5, user_id: target.id, status: 'attending', responded_at: new Date().toISOString() },
  { onConflict: 'club_id,year,month,user_id' }
)
if(error){
  console.log('❌ upsert 실패:', error.message)
} else {
  console.log('✅ upsert 성공 (DB 레벨)')
  // 정리
  await a.from('meeting_attendances').delete().eq('club_id',c.id).eq('year',2026).eq('month',5).eq('user_id',target.id)
  console.log('  - 정리 완료')
}

// 현재 5월 응답 상태
const {data:atts}=await a.from('meeting_attendances').select('user_id, status, users(full_name)').eq('club_id',c.id).eq('year',2026).eq('month',5)
console.log(`\n현재 5월 응답: ${atts?.length}건`)
atts?.forEach(r=>console.log(`  ${r.users?.full_name}: ${r.status}`))
