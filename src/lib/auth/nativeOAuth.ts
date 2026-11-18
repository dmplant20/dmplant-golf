'use client'
import { getNativeSupabase } from '@/lib/supabase/native-client'
import { createClient } from '@/lib/supabase/client'
import { isNativeApp } from '@/lib/native'

// 네이티브(Capacitor) Google/Apple 로그인 — 시스템 브라우저 + custom-scheme 딥링크 + PKCE.
//
// 흐름:
//  1) getNativeSupabase().signInWithOAuth({provider, redirectTo, skipBrowserRedirect})
//     → PKCE code_verifier 를 native 클라이언트 저장소에 보관, 인증 URL 반환
//  2) @capacitor/browser 로 시스템 브라우저(Chrome Custom Tab / SFSafariVC) 오픈
//     (Google 은 임베디드 WebView OAuth 차단 → 반드시 시스템 브라우저)
//  3) 로그인 완료 → com.interstellargolf.app://auth/callback?code=... 딥링크로 앱 복귀
//  4) appUrlOpen 리스너가 code 를 exchangeCodeForSession → 세션 획득
//  5) 브릿지: 기존 쿠키(ssr) 클라이언트에 setSession() → 서버 API 전부 인증(변경 0)
//
// 모든 진입점은 isNativeApp() 가드 뒤 → 웹 브라우저에선 실행되지 않는다.

const REDIRECT_URL = 'com.interstellargolf.app://auth/callback'

export async function signInWithProvider(provider: 'google' | 'apple'): Promise<void> {
  if (!isNativeApp()) return
  const { Browser } = await import('@capacitor/browser')
  const supabase = getNativeSupabase()
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: REDIRECT_URL, skipBrowserRedirect: true },
  })
  if (error) throw error
  if (data?.url) await Browser.open({ url: data.url })
}

export const signInWithGoogle = () => signInWithProvider('google')
export const signInWithApple  = () => signInWithProvider('apple')

let _listenerBound = false

/** 앱 부팅 시 1회 호출 — OAuth 딥링크 복귀를 처리하는 리스너 등록 */
export async function initNativeAuthListener(): Promise<void> {
  if (!isNativeApp() || _listenerBound) return
  _listenerBound = true
  const { App } = await import('@capacitor/app')
  const { Browser } = await import('@capacitor/browser')

  App.addListener('appUrlOpen', async ({ url }: { url: string }) => {
    if (!url || !url.startsWith(REDIRECT_URL)) return
    try {
      const u = new URL(url)
      const code    = u.searchParams.get('code')
      const errDesc = u.searchParams.get('error_description')
      if (errDesc) {
        console.warn('[nativeOAuth] provider error:', errDesc)
        try { await Browser.close() } catch { /* noop */ }
        return
      }
      if (!code) return

      const nativeSb = getNativeSupabase()
      const { data, error } = await nativeSb.auth.exchangeCodeForSession(code)
      if (error) throw error

      const session = data.session
      if (session) {
        // 브릿지 — 기존 쿠키 클라이언트에 세션 이식(vercel 오리진 쿠키에 기록)
        await createClient().auth.setSession({
          access_token:  session.access_token,
          refresh_token: session.refresh_token,
        })
      }
      try { await Browser.close() } catch { /* noop */ }
      window.location.assign('/dashboard')
    } catch (e) {
      console.error('[nativeOAuth] callback failed', e)
    }
  })
}
