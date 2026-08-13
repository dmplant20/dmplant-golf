// 이상철, 정동수 — 이메일 없는 회원 정식 등록 (이메일 받기 전까지 placeholder)
// 실행: node scripts/activate-lee-jung.mjs
//
// 정책:
//   - 이미 등록되어 있으면 status='approved' 로 갱신
//   - 등록 안 되어 있으면 placeholder 이메일로 신규 가입
//   - 이상철: 회비 면제 (advisor) → fee_type=null
//   - 정동수: 월회비 → fee_type='monthly', joined_at='2026-03-01'

import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
import path from 'node:path'

const ENV_PATH = path.resolve('.env.local')
if (!fs.existsSync(ENV_PATH)) { console.error('❌ .env.local 없음'); process.exit(1) }
fs.readFileSync(ENV_PATH, 'utf8').split('\n').forEach(line => {
  const m = line.match(/^([A-Z_]+)=(.*)$/)
  if (m) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
})

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPA_SK  = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!SUPA_URL || !SUPA_SK) { console.error('❌ env 누락'); process.exit(1) }

const admin = createClient(SUPA_URL, SUPA_SK, { auth: { autoRefreshToken: false, persistSession: false } })

function placeholderEmail(en) {
  const slug = en.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '')
  return `placeholder_${slug}@mgf.local`
}
function tempPassword() { return 'Golf@' + Math.floor(1000 + Math.random() * 9000) }

const TARGETS = [
  {
    name: '이상철', en: 'Lee sang cheol',
    role: 'advisor',
    fee_type: null,          // 고문 — 회비 면제
    joined_at: '2026-01-01', // 창립 시점
    phone: null,
  },
  {
    name: '정동수', en: 'Jung dong soo',
    role: 'member',
    fee_type: 'monthly',     // 월회비
    joined_at: '2026-03-01', // 3월 가입
    phone: '038-525-7811',
  },
]

async function main() {
  const { data: club, error: clubErr } = await admin.from('clubs').select('id,name').eq('name', 'MGF').single()
  if (clubErr || !club) { console.error('❌ MGF 클럽을 찾을 수 없음:', clubErr?.message); return }
  console.log('▶ MGF 클럽 ID:', club.id)

  for (const t of TARGETS) {
    console.log(`\n── ${t.name} (${t.en}) ──`)
    const email = placeholderEmail(t.en)

    // 1) public.users 에 이미 있는지
    let { data: existingUser } = await admin.from('users')
      .select('id, full_name, full_name_en, email, password_set')
      .eq('email', email).maybeSingle()

    // 영문명으로도 한번 더 시도
    if (!existingUser) {
      const { data: byName } = await admin.from('users')
        .select('id, full_name, full_name_en, email, password_set')
        .eq('full_name', t.name).maybeSingle()
      if (byName) existingUser = byName
    }

    let userId
    let createdNew = false
    let pw = null

    if (existingUser) {
      userId = existingUser.id
      console.log(`  ↻ 기존 user 재사용: ${userId.slice(0,8)} (email=${existingUser.email})`)
    } else {
      pw = tempPassword()
      const { data: created, error: authErr } = await admin.auth.admin.createUser({
        email, password: pw, email_confirm: true, user_metadata: { full_name: t.name },
      })
      if (authErr || !created?.user) { console.error(`  ❌ auth 생성 실패:`, authErr?.message); continue }
      userId = created.user.id
      createdNew = true
      console.log(`  ✓ 신규 auth 생성: ${userId.slice(0,8)}  email=${email}  pw=${pw}`)
    }

    // 2) public.users 정보 보강
    const updates = { full_name: t.name, full_name_en: t.en }
    if (t.phone) updates.phone = t.phone
    if (createdNew) updates.password_set = false
    const { error: uErr } = await admin.from('users').update(updates).eq('id', userId)
    if (uErr) console.warn(`  ⚠ users update:`, uErr.message)

    // 3) club_memberships — upsert (있으면 status='approved' 로, 없으면 신규)
    const { data: existingMem } = await admin.from('club_memberships')
      .select('id, status, role, fee_type, joined_at')
      .eq('club_id', club.id).eq('user_id', userId).maybeSingle()

    if (existingMem) {
      const memUpdates = {
        status: 'approved',
        role: t.role,
        fee_type: t.fee_type,
        joined_at: t.joined_at,
      }
      const { error: mErr } = await admin.from('club_memberships')
        .update(memUpdates).eq('id', existingMem.id)
      if (mErr) console.error(`  ❌ membership update:`, mErr.message)
      else console.log(`  ✓ 멤버십 갱신: status=approved, role=${t.role}, fee_type=${t.fee_type ?? '면제'}, joined=${t.joined_at}`)
    } else {
      const { error: mErr } = await admin.from('club_memberships').insert({
        club_id: club.id, user_id: userId,
        role: t.role, status: 'approved',
        fee_type: t.fee_type,
        joined_at: t.joined_at,
      })
      if (mErr) console.error(`  ❌ membership insert:`, mErr.message)
      else console.log(`  ✓ 멤버십 신규: status=approved, role=${t.role}, fee_type=${t.fee_type ?? '면제'}, joined=${t.joined_at}`)
    }
  }

  console.log('\n✅ 완료. 이상철·정동수 MGF 회원으로 활성화됨.')
  console.log('   이메일을 추후 받으면 회원관리 화면에서 이메일만 교체하면 정상 로그인 가능.')
}

main().catch(err => { console.error('💥 unexpected:', err); process.exit(1) })
