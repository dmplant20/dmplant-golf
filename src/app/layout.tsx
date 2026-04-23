import type { Metadata, Viewport } from 'next'
import './globals.css'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'

// ── Google Fonts 의존성 완전 제거 ─────────────────────────────────────────
// next/font/google 을 사용하면 빌드 시 Google 서버로 요청이 발생하고
// WebView 환경(카카오톡, Gmail 인앱브라우저 등)에서 Google의
// disallowed_useragent(403) 정책에 의해 차단됩니다.
// 대신 각 OS 기본 한글 폰트(Apple SD Gothic Neo / Noto Sans KR / Malgun Gothic)를
// 폴백 체인으로 사용합니다.

export const metadata: Metadata = {
  title: 'Inter Stellar GOLF',
  description: '골프 모임 관리 앱 | Golf Club Management App',
  manifest: '/manifest.json',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'IS Golf',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#16a34a',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="bg-gray-950 text-white antialiased min-h-screen">
        {children}
        <PwaInstallPrompt />

        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  // ════════════════════════════════════════════════════════════════════════
  // 1) WebView 감지 → Chrome 으로 강제 리다이렉트
  //    카카오톡·Gmail·Instagram 등 앱 내장 브라우저는 Google의
  //    'disallowed_useragent' 정책에 의해 차단됩니다.
  //    Android: intent:// URL로 Chrome을 강제 실행
  //    iOS:     PwaInstallPrompt 컴포넌트에서 배너 안내
  // ════════════════════════════════════════════════════════════════════════
  try {
    var ua = navigator.userAgent || '';
    var isAndroid   = /Android/i.test(ua);

    // 인앱 브라우저 패턴 (카카오톡, Line, Instagram, Facebook, Gmail WebView 등)
    var inApp = (
      /FBAN|FBAV/i.test(ua)      ||  // Facebook
      /Instagram/i.test(ua)      ||  // Instagram
      /KAKAOTALK|kakaotalk/i.test(ua)||// KakaoTalk
      /Line\\//.test(ua)          ||  // Line
      /NaverApp/i.test(ua)       ||  // Naver 앱
      / wv[)\\s]/i.test(ua)      ||  // Android Generic WebView
      /WebView/i.test(ua)        ||  // Generic WebView
      / GSA\\//i.test(ua)            // Google Search App
    );

    if (isAndroid && inApp) {
      var href = window.location.href;
      // Chrome intent URL — Chrome이 없으면 기본 브라우저 fallback
      window.location.replace(
        'intent://' + href.replace(/^https?:\\/\\//, '') +
        '#Intent;scheme=https;package=com.android.chrome;' +
        'S.browser_fallback_url=' + encodeURIComponent(href) + ';end'
      );
      return; // 이후 스크립트 실행 중단
    }
  } catch(e) {}

  // ════════════════════════════════════════════════════════════════════════
  // 2) Service Worker 등록 + 자동 업데이트
  // ════════════════════════════════════════════════════════════════════════
  if(!('serviceWorker' in navigator)) return;

  window.addEventListener('load', function(){
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then(function(reg){

        // ① 새 SW 설치 완료 → 즉시 skipWaiting 요청
        reg.addEventListener('updatefound', function(){
          var newSW = reg.installing;
          if(!newSW) return;
          newSW.addEventListener('statechange', function(){
            if(newSW.state === 'installed'){
              newSW.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        // ② 60초마다 서버 변경 확인
        setInterval(function(){ reg.update(); }, 60000);

        // ③ 앱 포커스 복귀 시 업데이트 확인
        document.addEventListener('visibilitychange', function(){
          if(document.visibilityState === 'visible') reg.update();
        });
      });

    // ④ 새 SW 활성화(controllerchange) → 자동 리로드
    var refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function(){
      if(refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    // ⑤ SW 에서 SW_ACTIVATED 메시지 → 자동 리로드
    navigator.serviceWorker.addEventListener('message', function(e){
      if(e.data && e.data.type === 'SW_ACTIVATED' && !refreshing){
        refreshing = true;
        window.location.reload();
      }
    });
  });
})();
`,
          }}
        />
      </body>
    </html>
  )
}
