import { createBrowserClient } from '@supabase/ssr'

// 세션 유지 강화 — 로그아웃 전에는 절대 끊기지 않게
//   persistSession: true   → localStorage 에 세션 저장 (브라우저 닫아도 유지)
//   autoRefreshToken: true → 만료 전 백그라운드 자동 갱신 (2주 default refresh)
//   detectSessionInUrl: true → magic-link / OAuth 콜백 자동 처리
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        storageKey: 'isgolf-supabase-auth',
        flowType: 'pkce',
      },
    }
  )
}
