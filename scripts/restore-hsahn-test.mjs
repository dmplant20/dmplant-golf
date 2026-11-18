import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })
const HSAHN = '9de9bbf3-609a-4ebf-b13c-1857b6ba7eed'
const MGF = '0b9b3498-f5c0-42a2-8fa2-1eafeafbf206'
const { data: before } = await a.from('meeting_attendances').select('status').eq('club_id', MGF).eq('user_id', HSAHN).eq('year', 2026).eq('month', 6).maybeSingle()
console.log('테스트 후 안한순 상태:', before?.status ?? '없음')
if (before?.status) {
  await a.from('meeting_attendances').delete().eq('club_id', MGF).eq('user_id', HSAHN).eq('year', 2026).eq('month', 6)
  console.log('✓ 미응답으로 복원 (실제 회원이라 테스트 잔재 제거)')
} else {
  console.log('이미 미응답 — 복원 불필요')
}
