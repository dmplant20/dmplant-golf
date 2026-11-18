import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})
const {error}=await a.from('users').update({full_name_en:null}).eq('full_name_en','Dmplant@gmail.com')
console.log(error ? '실패: '+error.message : '✓ dmplant 행 full_name_en → NULL 재설정')

// 최종 게스트 영문명 확인
const {data:gs}=await a.from('meeting_guests').select('full_name, full_name_en').order('full_name')
console.log('\n현재 모든 게스트:')
gs.forEach(g=>console.log(`  ${g.full_name?.padEnd(8)} → ${g.full_name_en ?? '(NULL)'}`))
