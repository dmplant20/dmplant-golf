import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'').trim()})
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const MGF = '0b9b3498-f5c0-42a2-8fa2-1eafeafbf206'

const c = createClient(URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
await c.auth.signInWithPassword({ email: 'hsahn@ilshin.co.kr', password: '12345678' })

console.log('=== members 페이지의 approved 쿼리 그대로 ===')
const { data: approved, error: e1 } = await c.from('club_memberships')
  .select('*, users(full_name, full_name_en, name_abbr, avatar_url, phone, last_seen_at, password_set)')
  .eq('club_id', MGF).eq('status', 'approved')
console.log(`approved: ${e1 ? '❌ ' + e1.message : (approved?.length ?? 0) + '건'}`)
if (approved?.length) {
  const nullUsers = approved.filter(m => !m.users)
  console.log(`  users JOIN null 인 행: ${nullUsers.length}건`)
  const names = approved.map(m => m.users?.full_name ?? '(null)').sort()
  console.log('  이름들:', names.join(', '))
}

console.log('\n=== withdrawn 쿼리 (withdrawn_at 정렬) ===')
const { data: w, error: e2 } = await c.from('club_memberships')
  .select('*, users(full_name)').eq('club_id', MGF).eq('status', 'withdrawn')
  .order('withdrawn_at', { ascending: false })
console.log(`withdrawn: ${e2 ? '❌ ' + e2.message : (w?.length ?? 0) + '건'}`)
await c.auth.signOut().catch(()=>{})
