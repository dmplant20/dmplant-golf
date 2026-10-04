// Supabase keep-alive + 헬스체크.
//
// 배경: 2026-10 Supabase Free 프로젝트가 7일 저활동으로 자동 일시정지(INACTIVE) →
// 모든 로그인이 AuthRetryableFetchError 로 실패했고 회원들은 "비밀번호 오류"로 인식함.
// Supabase 공식 기준: "매일 DB 요청이 몇 건 있으면" 정지되지 않음.
//
// 이 라우트는 매 호출마다 실제 DB 쿼리 여러 건 + Auth 헬스 요청을 발생시켜
// 활동량을 만들고, 결과를 200/503 으로 돌려준다 (값·키는 절대 노출하지 않음).
// 호출자: Vercel Cron(일 1회) + GitHub Actions(.github/workflows/supabase-keepalive.yml, 4시간마다).
import { NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const TABLES = ['users', 'clubs', 'club_memberships'] as const

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  const checks: Record<string, boolean> = {}

  // ① Auth 서버 헬스 — 프로젝트 정지 시 DNS 실패/5xx 로 false
  try {
    const r = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anon ?? '' },
      cache: 'no-store',
      signal: AbortSignal.timeout(10_000),
    })
    checks.auth = r.ok
  } catch {
    checks.auth = false
  }

  // ② DB 쿼리 — head count 만 (행 데이터 미반환). service_role 로 RLS 무관하게 실제 쿼리 발생
  if (url && serviceKey) {
    const service = createServiceClient(url, serviceKey, { auth: { persistSession: false } })
    for (const t of TABLES) {
      try {
        const { error } = await service.from(t).select('id', { count: 'exact', head: true })
        checks[`db_${t}`] = !error
      } catch {
        checks[`db_${t}`] = false
      }
    }
  } else {
    checks.db_service_key = false
  }

  const ok = Object.values(checks).every(Boolean)
  const res = NextResponse.json({ ok, checks, at: new Date().toISOString() }, { status: ok ? 200 : 503 })
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate')
  return res
}
