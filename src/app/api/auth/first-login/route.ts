import { NextResponse } from 'next/server'

// Email-only first login previously returned an admin-generated authentication
// token without proving mailbox ownership. Never issue tokens from this route.
// Restore onboarding only through a separately reviewed, possession-based flow.
export async function POST() {
  return NextResponse.json({
    error: '보안을 위해 이메일만으로 로그인하는 기능을 중단했습니다. 비밀번호로 로그인하거나 비밀번호 재설정을 이용해 주세요.',
    code: 'FIRST_LOGIN_DISABLED',
  }, { status: 403 })
}
