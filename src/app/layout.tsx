import type { Metadata, Viewport } from 'next'
import './globals.css'
import PwaInstallPrompt from '@/components/PwaInstallPrompt'

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
  if (!('serviceWorker' in navigator)) return;
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
        setInterval(function() { reg.update(); }, 60000);
        document.addEventListener('visibilitychange', function() {
          if (document.visibilityState === 'visible') reg.update();
        });
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
