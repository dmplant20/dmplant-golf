import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

console.log('=== 모든 클럽 round_scores 분포 ===')
const { data: clubs } = await a.from('clubs').select('id, name')
for (const c of clubs ?? []) {
  const { data: rs } = await a.from('round_scores').select('year, month, user_id, gross_score, users:user_id(full_name)').eq('club_id', c.id).order('year').order('month')
  console.log(`\n${c.name}  (총 ${rs?.length ?? 0}건)`)
  const groups = {}
  rs?.forEach(r => {
    const k = `${r.year}-${r.month}`
    if (!groups[k]) groups[k] = []
    groups[k].push(`${r.users?.full_name} ${r.gross_score}`)
  })
  Object.keys(groups).sort().forEach(k => console.log(`  ${k}: ${groups[k].join(', ')}`))
}
