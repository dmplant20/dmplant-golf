import { NextResponse } from 'next/server'

// Club membership roles are not yet protected by tested database RLS.
// Do not use them to authorize privileged Auth administration.
export async function POST() {
  return NextResponse.json({
    error: '관리자 회원 등록을 일시 중단했습니다. 이메일 소유 확인 절차를 사용해 주세요.',
    code: 'ADMIN_MEMBER_CREATION_DISABLED',
  }, { status: 403 })
}
