import fs from 'node:fs'
import pg from 'pg'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'').trim()})
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()
await client.query(`NOTIFY pgrst, 'reload schema'`)
console.log('✓ PostgREST 스키마 캐시 리로드 신호 전송')
await client.end()
