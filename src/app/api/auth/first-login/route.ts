// 첫 로그인 — 비밀번호 없이 이메일만으로 로그인
// 관리자가 사전 등록한 회원(password_set=false)에 한해서만 동작
//
// 흐름:
//   1) 클라가 POST { email } 호출
//   2) 서버가 service_role 로 users 테이블에서 password_set=false 인 행 조회
//   3) 있으면 admin.auth.admin.generateLink({ type: 'magiclink', email }) 호출
//   4) 응답의 hashed_token 을 클라에게 반환
//   5) 클라는 supabase.auth.verifyOtp({ token_hash, type: 'magiclink' }) 로 세션 획득

import { NextRequest, NextResponse } from 'next/server'
import { createClient as createServiceClient } from '@supabase/supabase-js'

function makeService() {
  const k = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!k) return null
  return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, k, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
}

export async function POST(req: NextRequest) {
  const { email } = await req.json() as { email?: string }
  if (!email) return NextResponse.json({ error: 'email 필수' }, { status: 400 })

  const service = makeService()
  if (!service) return NextResponse.json({ error: 'service role 미설정' }, { status: 500 })

  const cleanEmail = email.trim().toLowerCase()

  // 1. users 테이블에서 password_set=false 인 행 확인
  const { data: row, error: lookupErr } = await service.from('users')
    .select('id, password_set, email').eq('email', cleanEmail).maybeSingle()
  if (lookupErr) {
    console.error('[first-login lookup]', lookupErr)
    // 컬럼 없음 등 스키마 오류는 원인 노출 (관리자가 즉시 SQL 실행해 해결 가능)
    if (lookupErr.message?.includes('column') || lookupErr.code === 'PGRST204' || lookupErr.code === '42703') {
      return NextResponse.json({
        error: 'DB 스키마 미적용 — 관리자가 auth_password_setup.sql 을 실행해야 합니다',
        detail: lookupErr.message,
      }, { status: 500 })
    }
    return NextResponse.json({ error: lookupErr.message }, { status: 500 })
  }
  if (!row) {
    return NextResponse.json({ error: '등록되지 않은 이메일입니다' }, { status: 404 })
  }
  if (row.password_set === true) {
    return NextResponse.json({
      error: '이미 비밀번호가 설정된 계정입니다. 비밀번호로 로그인해 주세요.',
      already_set: true,
    }, { status: 403 })
  }

  // 2. magiclink 토큰 생성 (이메일 발송 안 함, 토큰만 받음)
  const { data, error } = await service.auth.admin.generateLink({
    type: 'magiclink',
    email: cleanEmail,
  })
  if (error || !data) {
    console.error('[first-login generateLink]', error)
    return NextResponse.json({ error: error?.message ?? '토큰 생성 실패' }, { status: 500 })
  }

  // generateLink 응답: properties.hashed_token + properties.action_link
  const hashed = (data as any).properties?.hashed_token
  if (!hashed) {
    return NextResponse.json({ error: 'hashed_token 누락' }, { status: 500 })
  }

  return NextResponse.json({ token_hash: hashed, email: cleanEmail })
}
