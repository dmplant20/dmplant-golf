import { createBrowserClient } from '@supabase/ssr'

// @supabase/ssr 의 기본값을 사용:
//   persistSession=true / autoRefreshToken=true / cookie 자동 동기화
// 커스텀 storageKey · flowType=pkce 지정 금지 — verifyOtp(magiclink) 후
// 서버 API 가 cookie 세션을 못 읽어 '로그인 필요' 401 발생함
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
