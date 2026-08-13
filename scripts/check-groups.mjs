import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const {data:c}=await a.from('clubs').select('id').eq('name','MGF').single()
const {data:groups}=await a.from('meeting_groups')
  .select('group_number, tee_time, course_name, meeting_group_members(user_id, guest_id, users(full_name), meeting_guests(full_name))')
  .eq('club_id',c.id).eq('year',2026).eq('month',5)
  .order('group_number')

for(const g of groups||[]){
  console.log(`\n${g.group_number}조 (${g.tee_time||'-'} / ${g.course_name||'-'})`)
  for(const m of g.meeting_group_members||[]){
    const isGuest = !!m.guest_id
    const gst = Array.isArray(m.meeting_guests) ? m.meeting_guests[0] : m.meeting_guests
    const nm = isGuest ? gst?.full_name : m.users?.full_name
    console.log(`  - ${isGuest?'🎫':' '} ${nm ?? '(null)'} (user_id=${m.user_id?.slice(0,8)??'-'}, guest_id=${m.guest_id?.slice(0,8)??'-'})`)
  }
}
