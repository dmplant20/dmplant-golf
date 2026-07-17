import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js'

// 네이티브(Capacitor) 전용 Supabase 클라이언트 — OAuth 딥링크(PKCE)용.
//
// 웹 클라이언트(client.ts)는 의도적으로 PKCE 를 쓰지 않는다(verifyOtp magiclink 보존).
// 네이티브 OAuth 딥링크는 exchangeCodeForSession → PKCE 필수이므로,
// storageKey 를 'isgolf-native-auth' 로 완전히 분리한 별도 클라이언트를 둔다.
// 여기서 얻은 세션은 nativeOAuth.ts 가 기존 쿠키 클라이언트에 setSession() 으로
// 이식하므로, 서버 API(쿠키 세션 기반)는 아무 변경 없이 그대로 동작한다.
//
// 이 모듈은 클라이언트에서만 import 되며(native OAuth 경로), 웹 브라우저에서도
// import 는 되지만 실제 호출은 isNativeApp() 가드 뒤에서만 일어난다.

let _client: SupabaseClient | null = null

export function getNativeSupabase(): SupabaseClient {
  if (_client) return _client
  _client = createSupabaseClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      auth: {
        flowType: 'pkce',
        detectSessionInUrl: false,   // 콜백 코드 교환은 nativeOAuth 가 수동 처리
        persistSession: true,
        autoRefreshToken: true,
        storageKey: 'isgolf-native-auth',   // 웹 쿠키 세션과 절대 충돌 없음
      },
    }
  )
  return _client
}
