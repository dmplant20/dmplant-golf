import type { Metadata, Viewport } from 'next'
import './globals.css'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'
import { autoMigrate } from '@/lib/db-migrate'

// 앱 시작 시 DB 스키마 자동 최신화 (누락 컬럼 자동 추가)
autoMigrate().catch(() => {/* 조용히 스킵 */})

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
  themeColor: '#c9a84c',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko">
      <head>
        {/* SVG favicon (modern browsers prefer this — sharper at any size) */}
        <link rel="icon" type="image/svg+xml" href="/icons/icon.svg" />
        <link rel="alternate icon" type="image/png" href="/icons/icon-192.png" />
        <link rel="apple-touch-icon" href="/icons/icon-192.png" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent" />
      </head>
      <body className="bg-gray-950 text-white antialiased min-h-screen">
        {children}
        <PwaInstallPrompt />

        <script dangerouslySetInnerHTML={{ __html: `
(function(){
  var ua = navigator.userAgent || '';

  // ── 1) WebView → Chrome 강제 리다이렉트 ─────────────────────────────────
  var inApp = /FBAN|FBAV|Instagram|KAKAOTALK|kakaotalk|Line\\/|NaverApp| wv[)\\s]|WebView| GSA\\/|MicroMessenger|Twitter\\/|Snapchat|TikTok/i.test(ua);
  if (/Android/i.test(ua) && inApp) {
    var href = window.location.href;
    window.location.replace(
      'intent://' + href.replace(/^https?:\\/\\//, '') +
      '#Intent;scheme=https;package=com.android.chrome;' +
      'S.browser_fallback_url=' + encodeURIComponent(href) + ';end'
    );
    return;
  }

  // ── 2) beforeinstallprompt를 React보다 먼저 캡처 ────────────────────────
  //    React 컴포넌트가 마운트되기 전에 이벤트가 발생해도 놓치지 않음
  window.__pwaPrompt = null;
  window.addEventListener('beforeinstallprompt', function(e) {
    e.preventDefault();
    window.__pwaPrompt = e;
    // React 컴포넌트에 알림
    window.dispatchEvent(new CustomEvent('pwa:installable'));
  });
  window.addEventListener('appinstalled', function() {
    window.__pwaPrompt = null;
    window.dispatchEvent(new CustomEvent('pwa:installed'));
    try { localStorage.setItem('pwa-installed','1'); } catch(e){}
  });

  // ── 3) Service Worker + 자동 업데이트 ───────────────────────────────────
  // dev (Turbopack) 에서는 SW 가 HMR 와 충돌 + /sw.js fetch 에러 → 프로덕션에서만 등록.
  // 이미 등록된 dev 잔여물이 있으면 깔끔히 해제.
  var __isProd = ${process.env.NODE_ENV === 'production' ? 'true' : 'false'};
  if (!('serviceWorker' in navigator)) return;
  if (!__isProd) {
    navigator.serviceWorker.getRegistrations().then(function(regs){
      regs.forEach(function(r){ r.unregister(); });
    }).catch(function(){});
    return;
  }
  window.addEventListener('load', function() {
    navigator.serviceWorker.register('/sw.js', { updateViaCache: 'none' })
      .then(function(reg) {
        reg.addEventListener('updatefound', function() {
          var sw = reg.installing;
          if (!sw) return;
          sw.addEventListener('statechange', function() {
            if (sw.state === 'installed') sw.postMessage({ type: 'SKIP_WAITING' });
          });
        });
        // 30초마다 SW 갱신 체크 — 새 빌드가 올라오면 즉시 업데이트
        setInterval(function() { reg.update(); }, 30000);
        document.addEventListener('visibilitychange', function() {
          if (document.visibilityState === 'visible') reg.update();
        });
        window.addEventListener('focus', function() { reg.update(); });
        window.addEventListener('online', function() { reg.update(); });
      });
    var refreshing = false;
    // /install 페이지에서는 리로드 금지 — SW 리로드가 beforeinstallprompt 를 날려버림
    var onInstallPage = window.location.pathname === '/install';
    navigator.serviceWorker.addEventListener('controllerchange', function() {
      if (refreshing || onInstallPage) return; refreshing = true; window.location.reload();
    });
    navigator.serviceWorker.addEventListener('message', function(e) {
      if (e.data && e.data.type === 'SW_ACTIVATED' && !refreshing && !onInstallPage) {
        refreshing = true; window.location.reload();
      }
    });
  });
})();
        ` }} />
      </body>
    </html>
  )
}
