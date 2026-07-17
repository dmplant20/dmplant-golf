// 배포된 API 가 실제로 작동하는지 확인 — anon key 로 호출
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})

// 로컬 dev 서버가 있다고 가정하지 말고, Vercel 배포본 호출
const VERCEL_URL = 'https://dmplant-golf.vercel.app'
const r = await fetch(`${VERCEL_URL}/api/meetings/rsvp`, {
  method:'POST',
  headers:{'Content-Type':'application/json'},
  body: JSON.stringify({club_id:'test',year:2026,month:5,status:'attending'}),
})
console.log('status:', r.status)
console.log('body:', await r.text())
