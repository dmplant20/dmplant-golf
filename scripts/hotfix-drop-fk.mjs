import fs from 'node:fs'
import pg from 'pg'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'').trim()})
const client = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } })
await client.connect()
// withdrawn_by FK 가 users 로의 2번째 관계를 만들어 PostgREST embed 모호성 유발 → 제약만 제거
// (컬럼/데이터 보존. 코드 수정 배포 후 다시 붙일 예정)
const { rows } = await client.query(`
  SELECT conname FROM pg_constraint
  WHERE conrelid = 'club_memberships'::regclass AND confrelid = 'users'::regclass
`)
console.log('users 참조 제약들:', rows.map(r => r.conname).join(', '))
for (const r of rows) {
  if (r.conname.includes('withdrawn_by')) {
    await client.query(`ALTER TABLE club_memberships DROP CONSTRAINT "${r.conname}"`)
    console.log(`✓ ${r.conname} 제거 완료`)
  }
}
await client.end()
