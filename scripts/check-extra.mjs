import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

// meeting_groups.course_name 컬럼 존재 여부
const {error}=await a.from('meeting_groups').select('course_name').limit(1)
console.log('meeting_groups.course_name:', error ? '❌ '+error.message : '✅')
