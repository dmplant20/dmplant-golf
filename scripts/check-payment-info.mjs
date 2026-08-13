// club_payment_info 점검 — 회비 납부 계좌 등록 상태 + RLS 정책 확인
// 실행: node scripts/check-payment-info.mjs
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})

const SUPA_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const ANON     = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const SK       = process.env.SUPABASE_SERVICE_ROLE_KEY

const admin = createClient(SUPA_URL, SK,  { auth: { persistSession: false } })

// 모든 클럽
const { data: clubs } = await admin.from('clubs').select('id,name').order('name')
console.log('▶ 클럽 목록:')
clubs?.forEach(c => console.log(`  ${c.name.padEnd(8)}  ${c.id.slice(0,8)}…`))
console.log()

console.log('▶ club_payment_info 전체 행 (service-role 우회):')
const { data: rows, error } = await admin.from('club_payment_info').select('*')
if (error) { console.log('  ❌', error.message); process.exit(1) }
if (!rows || rows.length === 0) {
  console.log('  ❌ club_payment_info 테이블이 비어 있음 (총무 저장이 실제로 안 됨)')
} else {
  rows.forEach(r => {
    const club = clubs?.find(c => c.id === r.club_id)
    console.log(`  ─── ${club?.name ?? '?'} (${r.club_id.slice(0,8)}…) ───`)
    console.log(`    bank_name    : ${r.bank_name ?? '(null)'}`)
    console.log(`    bank_account : ${r.bank_account ?? '(null)'}`)
    console.log(`    bank_holder  : ${r.bank_holder ?? '(null)'}`)
    console.log(`    qr_image_url : ${r.qr_image_url ? r.qr_image_url.slice(0, 60) + '…' : '(null)'}`)
    console.log(`    memo         : ${r.memo ?? '(null)'}`)
    console.log(`    updated_at   : ${r.updated_at ?? '?'}`)
  })
}

// RLS 정책 확인 — 일반 회원도 읽을 수 있는지
console.log()
console.log('▶ club_payment_info RLS 정책 (pg_policies):')
const { data: policies } = await admin.rpc('exec_sql', {
  q: `SELECT policyname, cmd, qual::text, with_check::text FROM pg_policies WHERE tablename='club_payment_info'`
}).catch(() => ({ data: null }))
if (policies) console.log(policies)
else {
  // RPC 없으면 raw query — Supabase 는 일반 query 로는 안 됨, REST 로 시도
  const res = await fetch(`${SUPA_URL}/rest/v1/rpc/`, { headers: { apikey: SK } })
  console.log('  (RLS 직접 조회 불가 — Supabase 대시보드에서 확인 필요)')
}

// 일반 회원 권한으로 동일 query 실행 — RLS 통과 여부 확인
console.log()
console.log('▶ 일반 회원 시뮬레이션 (anon key + 로그인된 user 컨텍스트 흉내):')
console.log('  service-role 로는 우회되지만, 실제 클라이언트는 anon + auth JWT 로 호출함')
console.log('  → anon 으로 회원 인증 없이 호출하면 결과 비교 가능')

const anon = createClient(SUPA_URL, ANON, { auth: { persistSession: false } })
const { data: anonRows, error: anonErr } = await anon.from('club_payment_info').select('*')
if (anonErr) {
  console.log(`  ❌ anon 조회 실패: ${anonErr.message}`)
} else {
  console.log(`  anon 으로 조회된 행: ${anonRows?.length ?? 0}개`)
  if (anonRows && anonRows.length === 0 && rows && rows.length > 0) {
    console.log(`  ⚠ RLS 가 anon 의 SELECT 를 막고 있음 — 인증된 회원만 봄`)
    console.log(`     실제 회원은 JWT 있어서 RLS 통과해야 하는데, 정책에 따라 막힐 수 있음`)
  }
}
