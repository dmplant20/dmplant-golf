import type { Metadata, Viewport } from 'next'
import { Inter, Noto_Sans_KR } from 'next/font/google'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const notoSansKR = Noto_Sans_KR({ subsets: ['latin'], variable: '--font-noto', weight: ['400', '500', '700'] })

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
      <body className={`${inter.variable} ${notoSansKR.variable} font-sans bg-gray-950 text-white antialiased min-h-screen`}>
        {children}
        <script
          dangerouslySetInnerHTML={{
            __html: `
(function(){
  if(!('serviceWorker' in navigator)) return;

  // ── SW 등록 + 자동 업데이트 ─────────────────────────────────────────
  window.addEventListener('load', function(){
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then(function(reg){

        // 1) 새 SW가 설치를 마치면 즉시 skipWaiting 요청
        reg.addEventListener('updatefound', function(){
          var newSW = reg.installing;
          if(!newSW) return;
          newSW.addEventListener('statechange', function(){
            if(newSW.state === 'installed'){
              // waiting 상태 — 강제 활성화 요청
              newSW.postMessage({ type: 'SKIP_WAITING' });
            }
          });
        });

        // 2) 60초마다 서버에서 sw.js 변경 여부 확인
        setInterval(function(){ reg.update(); }, 60000);

        // 3) 앱 포커스될 때마다 업데이트 확인 (탭 전환, 홈→앱 복귀)
        document.addEventListener('visibilitychange', function(){
          if(document.visibilityState === 'visible') reg.update();
        });
      });

    // 4) 새 SW가 클라이언트를 가져가면(controllerchange) 페이지 자동 리로드
    var refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', function(){
      if(refreshing) return;
      refreshing = true;
      window.location.reload();
    });

    // 5) SW에서 'SW_ACTIVATED' 메시지 수신 → 리로드 (위 4번과 중복 방지)
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
