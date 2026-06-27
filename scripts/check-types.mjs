import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// 첫 번째 row 의 raw value + type
const { data } = await a.from('round_scores').select('id, year, month, played_at').order('created_at',{ascending:false}).limit(3)
data?.forEach(r => {
  console.log(`row: year=${r.year} (${typeof r.year})  month=${r.month} (${typeof r.month})  played=${r.played_at}`)
})

// 다양한 필터로 시도
console.log('\n다양한 month 필터 시도:')
const tests = [
  { year: 2026, month: 6 },
  { year: '2026', month: '6' },
  { year: 2026, month: '06' },
]
for (const t of tests) {
  const { count, error } = await a.from('round_scores').select('*', { count:'exact', head:true })
    .eq('year', t.year).eq('month', t.month)
  console.log(`  year=${t.year} (${typeof t.year}) month=${t.month} (${typeof t.month}) → count=${count} err=${error?.message ?? '-'}`)
}

// played_at 으로 검색
console.log('\nplayed_at 으로 검색:')
const { count: c2 } = await a.from('round_scores').select('*',{count:'exact',head:true})
  .gte('played_at','2026-06-01').lte('played_at','2026-06-30')
console.log(`  played_at 2026-06: count=${c2}`)
