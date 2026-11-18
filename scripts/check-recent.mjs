import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

console.log('=== 최근 1시간 round_scores INSERT/UPDATE ===')
const oneHourAgo = new Date(Date.now() - 60*60*1000).toISOString()
const { data: rs } = await a.from('round_scores').select('*, users:user_id(full_name), clubs(name)').gte('updated_at', oneHourAgo).order('updated_at', { ascending: false })
console.log(`총 ${rs?.length ?? 0}건`)
rs?.forEach(r => console.log(`  [${r.clubs?.name}] ${r.year}-${r.month} ${r.users?.full_name} gross=${r.gross_score} updated=${r.updated_at} recorded_by=${r.recorded_by?.slice(0,8)}`))

console.log('\n=== 최근 1시간 finance INSERT ===')
const { data: ft } = await a.from('finance_transactions').select('*, users:member_id(full_name), clubs(name)').gte('created_at', oneHourAgo).order('created_at', { ascending: false }).limit(20)
console.log(`총 ${ft?.length ?? 0}건`)
ft?.forEach(t => console.log(`  [${t.clubs?.name}] ${t.users?.full_name} ${t.type} ${t.amount} ${t.description?.slice(0,50)} created=${t.created_at}`))
