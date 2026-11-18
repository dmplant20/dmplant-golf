import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})

const SQL = fs.readFileSync('src/lib/supabase/migration_guest_role.sql','utf8')
const url = process.env.NEXT_PUBLIC_SUPABASE_URL + '/rest/v1/rpc/exec_sql'
// 시도 1: exec_sql RPC (있을 경우)
const r1 = await fetch(url, {
  method:'POST',
  headers:{
    apikey: process.env.SUPABASE_SERVICE_ROLE_KEY,
    Authorization:'Bearer '+process.env.SUPABASE_SERVICE_ROLE_KEY,
    'Content-Type':'application/json',
  },
  body: JSON.stringify({ query: SQL }),
})
console.log('exec_sql status:', r1.status)
console.log(await r1.text())
