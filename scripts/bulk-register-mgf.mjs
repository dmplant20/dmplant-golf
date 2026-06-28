// MGF 회원 일괄 등록 스크립트 (1회용)
// 실행: node scripts/bulk-register-mgf.mjs [--dry-run]
// 환경: 프로젝트 루트의 .env.local 의 SUPABASE_SERVICE_ROLE_KEY 사용
//
// 정책:
//   1) 이메일 있고 노란색 아님 → status='approved', 임시 비밀번호 생성
//   2) 이메일 있고 노란색       → status='pending', 임시 비밀번호 생성
//   3) 이메일 없음              → placeholder 이메일, status='pending'
//   4) 정동수 (이메일X, 노란색X) → 사용자 지시: pending 처리
//   5) 동일 이메일이 다른 클럽(예: 300회)에 이미 있으면 자동 연결 (auth user 재사용)

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

const DRY = process.argv.includes('--dry-run')
const admin = createClient(SUPA_URL, SUPA_SK, { auth: { autoRefreshToken: false, persistSession: false } })

// ── 회원 데이터 (Excel 회원명단 시트에서 추출) ───────────────────────────
// yellow=true → 노란색 표시 (등록만, 활성화 X)
// 이메일 없음 → placeholder 사용
const MEMBERS = [
  // 이미 등록됨, 스킵: { name: '최성복', en: 'Choi seong bok', email: 'dmplant@naver.com', role: 'president' },
  { name: '이상철',  en: 'Lee sang cheol',     email: null,                            phone: null,             role: 'advisor',  yellow: true  },
  { name: '이상욱',  en: 'Lee sang wook',      email: 'wok1818@wintrading.com',        phone: '090-875-1280',   role: 'advisor',  yellow: false },
  { name: '김호영',  en: 'Kim ho young',       email: 'hykim@wintrading.co.kr',        phone: '093-177-5200',   role: 'secretary',yellow: false },
  { name: '여환상',  en: 'Yeo hwan sang',      email: '0524sang@gmail.com',            phone: null,             role: 'member',   yellow: false },
  { name: '김재헌',  en: 'Kim jae hun',        email: 'jhnet20@naver.com',             phone: '076-773-4302',   role: 'member',   yellow: false },
  { name: '이준호',  en: 'Lee jun ho',         email: 'k01036012693@gmail.com',        phone: '077-301-7661',   role: 'member',   yellow: false },
  { name: '이상용',  en: 'Lee sang yong',      email: 'sang2442@wintrading.co.kr',     phone: '093-111-8733',   role: 'member',   yellow: false },
  { name: '이영규',  en: 'Lee young gyu',      email: 'polybagsa@naver.com',           phone: null,             role: 'member',   yellow: false },
  { name: '오정현',  en: 'Oh jung hun',        email: 'ojh4824@gmail.com',             phone: '090-633-2580',   role: 'member',   yellow: false },
  { name: '전용수',  en: 'Chun yong soo',      email: 'simonk@unisollvina.com',        phone: '093-102-0595',   role: 'member',   yellow: false },
  { name: '박창수',  en: 'Pack chang soo',     email: 'cspark@yckorea.com',            phone: null,             role: 'member',   yellow: false },
  { name: '최경식',  en: 'Choi kyeong sig',    email: 'joseph010328@gmail.com',        phone: '090-383-1677',   role: 'member',   yellow: false },
  { name: '백대준',  en: 'Baik dae jun',       email: 'djbaik@dsvina.com.vn',          phone: '033-672-5587',   role: 'member',   yellow: false },
  { name: '정정례',  en: 'Jung jung rae',      email: 'j2652@hwashintnp.com',          phone: '093-339-0795',   role: 'member',   yellow: false },
  { name: '안한순',  en: 'An han soon',        email: 'hsahn@ilshin.co.kr',            phone: null,             role: 'member',   yellow: false },
  { name: '김진태',  en: 'Kim jin tae',        email: 'llkjhgf62@daum.net',            phone: '076-576-7287',   role: 'member',   yellow: false },
  { name: '배상주',  en: 'Bae sang joo',       email: 'baesangju275@gmail.com',        phone: '090-254-2600',   role: 'member',   yellow: true  },
  { name: '양우영',  en: 'Yang woo young',     email: null,                            phone: null,             role: 'member',   yellow: true  },
  { name: '양경재',  en: 'Yang kyeong jae',    email: 'jasonyg@hanmail.net',           phone: null,             role: 'member',   yellow: true  },
  { name: '전하영',  en: 'Chun ha young',      email: 'leesuntex@naver.com',           phone: '093-665-2525',   role: 'member',   yellow: false },
  { name: '임현재',  en: 'Im hyeon jae',       email: '67water@naver.com',             phone: null,             role: 'member',   yellow: true  },
  { name: '이규식',  en: 'Lee gyu sik',        email: 'S01050985440@gmail.com',        phone: '076-489-7645',   role: 'member',   yellow: false },
  { name: '정동수',  en: 'Jung dong soo',      email: null,                            phone: '038-525-7811',   role: 'member',   yellow: false }, // pending — 이메일 없음
  { name: '최규삼',  en: 'Choi gyu sam',       email: 'design932@gmail.com',           phone: '090-967-8587',   role: 'member',   yellow: false },
  { name: '신종섭',  en: 'Sin jong sub',       email: 'taupe1@wintrading.co.kr',       phone: '096-183-1113',   role: 'member',   yellow: false },
  { name: '이태화',  en: 'Lee tae hwa',        email: 'edwardlee@wintrading.co.kr',    phone: '093-111-2770',   role: 'member',   yellow: false },
  { name: '김경철',  en: 'Kim kyeong cheol',   email: null,                            phone: null,             role: 'member',   yellow: true  },
]

// 모든 신규 회원에 동일한 임시 비밀번호 사용 — 첫 로그인 시 본인이 변경
const DEFAULT_TEMP_PASSWORD = '12345678'
function tempPassword() {
  return DEFAULT_TEMP_PASSWORD
}
function placeholderEmail(en) {
  // 영문명에서 안전한 슬러그 생성
  const slug = en.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/(^_|_$)/g, '')
  return `placeholder_${slug}@mgf.local`
}

async function main() {
  console.log(`▶ MGF 일괄 등록 ${DRY ? '(DRY-RUN)' : '(REAL)'} — ${MEMBERS.length}명`)

  // 1. MGF 클럽 ID 조회
  const { data: club, error: clubErr } = await admin.from('clubs').select('id,name').eq('name', 'MGF').single()
  if (clubErr || !club) { console.error('❌ MGF 클럽을 찾을 수 없음:', clubErr?.message); return }
  console.log('  클럽 ID:', club.id)

  const summary = { ok: [], skipped: [], failed: [] }

  for (const m of MEMBERS) {
    const isPending = m.yellow || !m.email                 // 노란색 OR 이메일 없음
    const email = m.email ?? placeholderEmail(m.en)
    const status = isPending ? 'pending' : 'approved'
    const pw = tempPassword()
    const tag = `[${m.role.padEnd(9)}|${status.padEnd(8)}|${m.yellow?'Y':'.'}|${m.email?'E':'-'}]`

    if (DRY) {
      console.log(`  ${tag} ${m.name.padEnd(4)} ${email}  pw=${pw}`)
      summary.ok.push({ ...m, email, status, pw })
      continue
    }

    // 이미 같은 이메일로 가입된 사용자 확인 (300회 등 / 이전 실행)
    const { data: existingUser } = await admin.from('users').select('id,full_name').eq('email', email).maybeSingle()
    let userId
    let isNew = false
    if (existingUser) {
      userId = existingUser.id
      console.log(`  ${tag} ${m.name} ↻ 기존 user 재사용 (${userId.slice(0,8)})`)
    } else {
      // auth 유저 생성 — Supabase 트리거가 public.users 행을 자동 생성함
      const { data: created, error: authErr } = await admin.auth.admin.createUser({
        email,
        password: pw,
        email_confirm: true,
        user_metadata: { full_name: m.name },
      })
      if (authErr || !created?.user) {
        console.error(`  ❌ ${m.name} auth 실패:`, authErr?.message)
        summary.failed.push({ ...m, email, error: authErr?.message })
        continue
      }
      userId = created.user.id
      isNew = true
    }
    // public.users UPDATE (트리거 생성 행 또는 기존 행 모두 갱신)
    // — 기존 데이터 보호를 위해 NULL 인 경우만 채움
    const updates = {}
    if (m.name) updates.full_name = m.name
    if (m.en) updates.full_name_en = m.en
    if (m.phone) updates.phone = m.phone
    if (isNew && Object.keys(updates).length) {
      // 신규 생성된 사용자만 password_set=false 로 마킹 (첫 로그인 시 비밀번호 설정 팝업)
      updates.password_set = false
      const { error: uErr } = await admin.from('users').update(updates).eq('id', userId)
      if (uErr) console.warn(`  ⚠ ${m.name} users update 경고:`, uErr.message)
    }

    // 이미 MGF 멤버인지 확인 (idempotent)
    const { data: existingMem } = await admin.from('club_memberships')
      .select('id').eq('club_id', club.id).eq('user_id', userId).maybeSingle()
    if (existingMem) {
      summary.skipped.push({ ...m, email, reason: '이미 MGF 멤버' })
      console.log(`  ${tag} ${m.name} ⊙ 이미 MGF 멤버 (skip)`)
      continue
    }

    const { error: memErr } = await admin.from('club_memberships').insert({
      club_id: club.id,
      user_id: userId,
      role: m.role,
      status,
      joined_at: new Date().toISOString(),
    })
    if (memErr) {
      console.error(`  ❌ ${m.name} 멤버십 insert 실패:`, memErr.message)
      summary.failed.push({ ...m, email, error: memErr.message })
      continue
    }
    console.log(`  ${tag} ${m.name} ✓ ${email} pw=${pw}`)
    summary.ok.push({ ...m, email, status, pw, userId })
  }

  console.log('\n=== 결과 요약 ===')
  console.log(`✓ 성공:  ${summary.ok.length}`)
  console.log(`⊙ 스킵: ${summary.skipped.length}`)
  console.log(`❌ 실패: ${summary.failed.length}`)

  if (!DRY && summary.ok.length) {
    const tmp = process.env.TEMP || process.env.TMP || '.'
    const outPath = path.join(tmp, 'mgf-credentials.tsv')
    const out = summary.ok.map(x => `${x.name}\t${x.en}\t${x.email}\t${x.status}\t${x.pw ?? '-'}`).join('\n')
    fs.writeFileSync(outPath, '회원명\t영문\t이메일\t상태\t임시비밀번호\n' + out, 'utf8')
    console.log(`\n📋 임시 비밀번호 목록 → ${outPath} 저장`)
  }

  if (summary.failed.length) {
    console.log('\n실패 상세:')
    summary.failed.forEach(f => console.log(`  - ${f.name}: ${f.error}`))
  }
}

main().catch(err => { console.error('💥 unexpected:', err); process.exit(1) })
