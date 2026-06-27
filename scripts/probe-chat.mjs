import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const {error:e1}=await a.from('chat_room_members').select('last_read_at').limit(1)
console.log('chat_room_members.last_read_at:', e1?'❌ '+e1.message:'✅')

const {data:rooms}=await a.from('chat_rooms').select('id,name,type,last_message_at').limit(5)
console.log('chat_rooms sample:', rooms?.length, 'rooms')

const {error:e2}=await a.from('chat_room_members').select('*').limit(1)
console.log('chat_room_members:', e2?'❌ '+e2.message:'✅')
