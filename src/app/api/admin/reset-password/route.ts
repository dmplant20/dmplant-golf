import { NextResponse } from 'next/server'

// Club membership roles are not yet protected by tested database RLS.
// Do not use them to authorize privileged Auth administration.
export async function POST() {
  return NextResponse.json({
    error: '관리자 대리 비밀번호 변경을 일시 중단했습니다. 계정 소유자가 비밀번호 재설정을 이용해 주세요.',
    code: 'ADMIN_PASSWORD_RESET_DISABLED',
  }, { status: 403 })
}
