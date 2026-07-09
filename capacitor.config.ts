import type { CapacitorConfig } from '@capacitor/cli'

// Capacitor "remote-URL" 셸 — 배포된 Vercel 사이트를 그대로 로드.
// appendUserAgent 의 InterStellarGolfApp 토큰으로 웹 코드가 "공식 앱"을 식별해
// WebView 외부브라우저 리다이렉트를 우회한다(src/lib/native.ts).
const config: CapacitorConfig = {
  appId: 'com.interstellargolf.app',
  appName: 'Inter Stellar GOLF',
  webDir: 'public',           // 미사용(remote URL 로드). cap 요구로 placeholder 지정
  appendUserAgent: 'InterStellarGolfApp',
  server: {
    url: 'https://dmplant-golf.vercel.app',
    cleartext: false,
    androidScheme: 'https',
  },
  plugins: {
    PushNotifications: {
      presentationOptions: ['badge', 'sound', 'alert'],
    },
    SplashScreen: {
      backgroundColor: '#0a0807',
      launchShowDuration: 1200,
      showSpinner: false,
    },
  },
}

export default config
