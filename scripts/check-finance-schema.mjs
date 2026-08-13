import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const { data, error } = await a.from('finance_transactions').select('*').limit(1)
if (error) console.log('error:', error.message)
else if (data?.[0]) {
  console.log('finance_transactions 컬럼들:')
  Object.keys(data[0]).forEach(k => console.log(`  ${k}: ${typeof data[0][k]} = ${JSON.stringify(data[0][k])?.slice(0,50)}`))
} else {
  console.log('빈 테이블')
}

// admin 으로 컬럼 추가 시도 — paid, fine_kind, paid_at
console.log('\n컬럼 추가 시도 (이미 있으면 idempotent):')
const cols = ['paid', 'paid_at', 'fine_kind']
for (const c of cols) {
  const { data: probe, error: pErr } = await a.from('finance_transactions').select(c).limit(1)
  if (pErr) console.log(`  ${c}: ❌ ${pErr.message}`)
  else console.log(`  ${c}: ✓ 존재`)
}
