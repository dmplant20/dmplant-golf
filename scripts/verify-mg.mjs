import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const {data:c}=await a.from('clubs').select('id').eq('name','MGF').single()
const {data:u}=await a.from('users').select('id').eq('full_name','최성복').single()

// 1) 테이블·컬럼 모두 존재 확인
const checks = [
  ['meeting_guests',           ()=>a.from('meeting_guests').select('id,full_name,full_name_en,handicap,notes,approved').limit(1)],
  ['meeting_group_members.guest_id', ()=>a.from('meeting_group_members').select('guest_id').limit(1)],
]
for(const [name, fn] of checks){
  const {error} = await fn()
  console.log(`${name}: ${error ? '❌ '+error.message : '✅'}`)
}

// 2) 실제 insert + select + delete 사이클 — 테이블 정상 작동 검증
const TEST_NAME = '__테스트게스트__'
const {data:ins,error:insErr} = await a.from('meeting_guests').insert({
  club_id: c.id, year: 2026, month: 5,
  full_name: TEST_NAME,
  full_name_en: 'TEST GUEST',
  handicap: 18,
  notes: '검증용 더미',
  recommended_by: u.id,
}).select().single()

if(insErr){
  console.log('❌ INSERT 실패:', insErr.message, '/ code:', insErr.code)
  process.exit(1)
}
console.log('✅ INSERT 성공 — id:', ins.id.slice(0,8))

const {data:sel}=await a.from('meeting_guests').select('*').eq('id', ins.id).single()
console.log('✅ SELECT 성공 — name:', sel.full_name, '/ handicap:', sel.handicap)

await a.from('meeting_guests').delete().eq('id', ins.id)
console.log('✅ DELETE 성공 — 테스트 행 정리 완료')

console.log('\n🎉 게스트 추천 테이블 완벽 작동')
