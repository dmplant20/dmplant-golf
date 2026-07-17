// 300 클럽 일반 회원으로 로그인해서 recurring_meetings + club_memberships 쿼리 직접 실행
// 안한순 (300 president) 와 임의 300 일반회원을 비교
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const URL  = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SK   = process.env.SUPABASE_SERVICE_ROLE_KEY

const admin = createClient(URL, SK, { auth: { persistSession: false } })
const CLUB_300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'

// 1) recurring_meetings RLS policy 정보
console.log('▶ 300 클럽 recurring_meetings 행 (service-role 직접):')
const { data: pat } = await admin.from('recurring_meetings').select('*').eq('club_id', CLUB_300).maybeSingle()
console.log(pat ?? '(없음)')

console.log('\n▶ club_memberships 컬럼 점검 — club_handicap 존재?')
const { data: mem1 } = await admin.from('club_memberships').select('*').eq('club_id', CLUB_300).limit(1)
if (mem1 && mem1[0]) console.log('  컬럼들:', Object.keys(mem1[0]).join(', '))

// 2) 안한순(300 president) 으로 로그인 후 정확히 meetings/page.tsx load() 와 동일한 query
console.log('\n▶ 안한순 로그인 후 load() 시뮬레이션...')
const c = createClient(URL, ANON, { auth: { persistSession: false } })
const { data: signin, error: signErr } = await c.auth.signInWithPassword({
  email: 'hsahn@ilshin.co.kr', password: '12345678',
})
if (signErr) { console.log('  ❌ 로그인:', signErr.message); process.exit(1) }
console.log('  ✓ 로그인 OK —', signin.user.id.slice(0,8))

// 안한순의 currentClubId 는 300 이라 가정
const [r1, r2, r3] = await Promise.all([
  c.from('recurring_meetings').select('*').eq('club_id', CLUB_300).maybeSingle(),
  c.from('meeting_overrides').select('*').eq('club_id', CLUB_300),
  c.from('club_memberships')
    .select('user_id, club_handicap, users(full_name, full_name_en, name_abbr)')
    .eq('club_id', CLUB_300).eq('status', 'approved'),
])
console.log('  recurring_meetings  :', r1.error?.message ?? `data=${r1.data ? '있음' : '(null)'}`)
if (r1.data) console.log(`    pattern: ${r1.data.week_of_month}째 ${['일','월','화','수','목','금','토'][r1.data.day_of_week]} ${r1.data.start_time} @ ${r1.data.venue}`)
console.log('  meeting_overrides   :', r2.error?.message ?? `${r2.data?.length}개`)
console.log('  club_memberships    :', r3.error?.message ?? `${r3.data?.length}명`)

// 3) 일반 회원 (최성복 — 300 member) 으로도 똑같이 — 비번 모르니까 우회: temp password 강제 설정
console.log('\n▶ 최성복(dmplant, 300 member) 시뮬레이션 — 비번 임시 변경 후 다시 원복')
// 비번 안 바꾸고 — 다른 300 일반회원 찾기
const { data: m300 } = await admin.from('club_memberships').select('user_id, role, users(full_name, email)').eq('club_id', CLUB_300).eq('status','approved').eq('role','member').limit(3)
console.log('  300 일반회원 후보:')
m300?.forEach(m => console.log(`    ${m.users.full_name}  ${m.users.email}`))

await c.auth.signOut().catch(()=>{})
