import { NextResponse } from 'next/server'

// Request-triggered owner-level schema/policy changes are intentionally disabled.
// Deploy reviewed versioned migrations through the administrative migration path.
export async function GET() {
  return NextResponse.json({
    error: '자동 스키마 변경은 중단되었습니다. 검토된 마이그레이션을 사용해 주세요.',
    code: 'RUNTIME_MIGRATION_DISABLED',
  }, { status: 410 })
}
