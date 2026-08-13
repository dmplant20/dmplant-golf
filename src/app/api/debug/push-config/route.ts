// 푸시 설정 진단 — production 의 VAPID 키 / 환경변수 동기화 점검
// 공개키는 안전하게 노출 가능 (NEXT_PUBLIC_*), 비밀키는 length 만 노출
import { NextResponse } from 'next/server'

export async function GET() {
  const pub  = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '').trim().replace(/^["']|["']$/g, '')
  const priv = (process.env.VAPID_PRIVATE_KEY ?? '').trim().replace(/^["']|["']$/g, '')

  const expectedPub = 'BN3djv34HxEMMf7K2ebwz34LIg7HUjl1kZiYZNewGiodOkdI-WA2wt7QiCLlqQbtfai-_RsEH9aTvvVlVEsYhFw'

  return NextResponse.json({
    NEXT_PUBLIC_VAPID_PUBLIC_KEY: {
      set: Boolean(pub),
      length: pub.length,
      first20: pub.slice(0, 20),
      last10: pub.slice(-10),
      matches_expected: pub === expectedPub,
    },
    VAPID_PRIVATE_KEY: {
      set: Boolean(priv),
      length: priv.length,
    },
    VAPID_EMAIL: {
      set: Boolean(process.env.VAPID_EMAIL),
      value: process.env.VAPID_EMAIL,
    },
    SUPABASE_SERVICE_ROLE_KEY: {
      set: Boolean(process.env.SUPABASE_SERVICE_ROLE_KEY),
    },
    NEXT_PUBLIC_SUPABASE_URL: {
      set: Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL),
      value: process.env.NEXT_PUBLIC_SUPABASE_URL,
    },
    note: 'matches_expected=false 면 Vercel 환경변수와 .env.local 이 다른 것. 위 expected 값으로 통일 필요.',
  })
}
