// 공식 네이티브 앱(Capacitor 셸) 감지 헬퍼.
//
// Capacitor 셸은 capacitor.config 의 appendUserAgent='InterStellarGolfApp' 로
// WebView User-Agent 에 이 토큰을 덧붙인다. 일반 브라우저·PWA·카카오/인스타 등
// 인앱브라우저 UA 에는 이 토큰이 절대 없으므로, 이 토큰 기반 분기는
// 웹에서 항상 false → 기존 웹 동작은 100% 불변(no-op)이다.
//
// 토큰 'InterStellarGolfApp' 은 middleware 의 WEBVIEW_RE 패턴들과
// 겹치는 부분 문자열이 없도록 선택했다(wv/WebView/앱이름들과 무충돌).

export const NATIVE_UA_TOKEN = 'InterStellarGolfApp'

const NATIVE_UA_RE = /InterStellarGolfApp/i

/** 서버(미들웨어, Edge) / 클라이언트 공용 — UA 문자열에 네이티브 토큰이 있는지 */
export function isNativeUA(ua: string | null | undefined): boolean {
  return !!ua && NATIVE_UA_RE.test(ua)
}

/** 클라이언트 전용 — Capacitor 네이티브 런타임(WebView) 위에서 실행 중인지 */
export function isNativeApp(): boolean {
  if (typeof window === 'undefined') return false
  const cap = (window as { Capacitor?: { isNativePlatform?: () => boolean } }).Capacitor
  if (cap?.isNativePlatform?.()) return true
  // 폴백: 브릿지 주입 전 타이밍 대비 UA 토큰으로도 판별
  return isNativeUA(window.navigator?.userAgent)
}
