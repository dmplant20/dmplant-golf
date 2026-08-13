import { NextResponse } from 'next/server'
import { autoMigrate } from '@/lib/db-migrate'

/**
 * GET /api/system/init
 * 앱 최초 로드 시 클라이언트에서 한 번 호출 → DB 스키마 자동 최신화
 */
export async function GET() {
  await autoMigrate()
  return NextResponse.json({ ok: true })
}
