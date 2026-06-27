// 현재 배포 버전 — 클라이언트가 주기적으로 폴링해서 버전이 바뀌면 강제 reload
// Vercel 이 빌드시 VERCEL_GIT_COMMIT_SHA 를 주입. 로컬은 빌드시각으로 폴백.
import { NextResponse } from 'next/server'

// 빌드 타임 상수 — Next.js 가 빌드 시 인라이닝
const BUILD_VERSION =
  process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 12) ??
  process.env.NEXT_PUBLIC_BUILD_VERSION ??
  String(Date.now())

const BUILD_TIME = new Date().toISOString()

export const dynamic = 'force-dynamic'    // 항상 신선
export const revalidate = 0

export async function GET() {
  const res = NextResponse.json({
    version: BUILD_VERSION,
    builtAt: BUILD_TIME,
  })
  // 캐시 절대 금지 — 항상 최신 응답
  res.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate, proxy-revalidate')
  res.headers.set('Pragma', 'no-cache')
  res.headers.set('Expires', '0')
  return res
}
