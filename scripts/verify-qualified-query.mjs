import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'').trim()})
const c = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
await c.auth.signInWithPassword({ email: 'hsahn@ilshin.co.kr', password: '12345678' })
const MGF = '0b9b3498-f5c0-42a2-8fa2-1eafeafbf206'
// 수정된 형태 (users:user_id) — FK 있든 없든 항상 작동해야 함
const { data, error } = await c.from('club_memberships')
  .select('*, users:user_id(full_name, full_name_en, name_abbr, avatar_url, phone, last_seen_at, password_set)')
  .eq('club_id', MGF).eq('status', 'approved')
console.log(`수정된 쿼리 (users:user_id): ${error ? '❌ ' + error.message : '✓ ' + data.length + '명 (이규식 포함: ' + (data.some(m => m.users?.full_name === '이규식') ? 'YES' : 'NO') + ')'}`)
await c.auth.signOut().catch(()=>{})
