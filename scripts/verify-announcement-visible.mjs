// 등록된 공지가 일반 회원에게 정상 노출되는지 검증 (RLS 통과 여부)
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SK  = process.env.SUPABASE_SERVICE_ROLE_KEY
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const admin = createClient(URL, SK, { auth: { persistSession: false } })

// 1) 방금 만든 300 클럽 공지 확인
const CLUB_300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'
console.log('▶ 300 클럽 6월 공지 (service-role):')
const { data: ann } = await admin.from('announcements').select('*')
  .eq('club_id', CLUB_300).ilike('title', '[정기모임-2026-6]%').maybeSingle()
console.log(ann ? `  id=${ann.id.slice(0,8)} title=${ann.title}` : '  (없음)')
if (ann) {
  console.log(`  is_meeting=${ann.is_meeting}, expires_at=${ann.expires_at}`)
  console.log(`  created_at=${ann.created_at}`)
}

// 2) 일반 회원(안한순=300 회장) 으로 로그인해 dashboard 쿼리 그대로 실행
console.log('\n▶ 안한순(300 president) 로그인 후 dashboard 동일 쿼리:')
const c = createClient(URL, ANON, { auth: { persistSession: false } })
const { error: signErr } = await c.auth.signInWithPassword({ email: 'hsahn@ilshin.co.kr', password: '12345678' })
if (signErr) { console.log('  ❌ 로그인:', signErr.message); process.exit(1) }

const { data: ann1, error: a1Err } = await c.from('announcements')
  .select('id,title,title_en,created_at')
  .eq('club_id', CLUB_300).order('created_at', { ascending: false }).limit(3)
console.log('  dashboard 쿼리:', a1Err?.message ?? `${ann1?.length}건`)
ann1?.forEach(a => console.log(`    - ${a.title}`))

// 3) 일반 회원도 한 명 — 조수용
console.log('\n▶ 조수용(300 일반회원) 로그인 시도:')
const { data: u } = await admin.from('users').select('id,email').eq('full_name','조수용').maybeSingle()
console.log('  조수용 id/email:', u?.id?.slice(0,8), u?.email)

await c.auth.signOut().catch(()=>{})
