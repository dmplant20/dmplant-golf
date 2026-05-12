import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const {data:c}=await a.from('clubs').select('id').eq('name','MGF').single()
const {data:before}=await a.from('club_payment_info').select('memo').eq('club_id',c.id).maybeSingle()
console.log('기존 memo:', JSON.stringify(before?.memo))
const {error}=await a.from('club_payment_info').update({memo:null}).eq('club_id',c.id)
if(error){ console.error('update:',error.message); process.exit(1) }
const {data:after}=await a.from('club_payment_info').select('memo').eq('club_id',c.id).maybeSingle()
console.log('변경 후 memo:', JSON.stringify(after?.memo))
