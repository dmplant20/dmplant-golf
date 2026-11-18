import { NextResponse } from 'next/server'

// Club roles must never authorize owner-level DDL from an HTTP request.
function disabled() {
  return NextResponse.json({
    error: '앱에서 스키마를 변경할 수 없습니다. 검토된 마이그레이션을 사용해 주세요.',
    code: 'RUNTIME_MIGRATION_DISABLED',
  }, { status: 410 })
}
export async function GET() { return disabled() }
export async function POST() { return disabled() }
