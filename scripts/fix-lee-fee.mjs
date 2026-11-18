import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const {data:c}=await a.from('clubs').select('id').eq('name','MGF').single()
const {data:u}=await a.from('users').select('id,full_name').eq('full_name','이상철').single()

// 이상철 — 회비 면제 해제, 월회비로 설정
const {error}=await a.from('club_memberships')
  .update({ fee_type:'monthly' })
  .eq('club_id', c.id).eq('user_id', u.id)

if(error){ console.error('실패:', error.message); process.exit(1) }

const {data:mem}=await a.from('club_memberships')
  .select('role, status, fee_type, joined_at')
  .eq('club_id', c.id).eq('user_id', u.id).single()
console.log('✓ 이상철 멤버십 상태:')
console.log('  role     :', mem.role)
console.log('  status   :', mem.status)
console.log('  fee_type :', mem.fee_type)
console.log('  joined_at:', mem.joined_at)
