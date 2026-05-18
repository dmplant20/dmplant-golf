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

  // ── 3a) 매일 자정 자동 캐시 삭제 + 강제 새로고침 ─────────────────────────
  // 회원이 별도 액션 안 해도 매일 한 번 stale 캐시 완전 청소 후 최신 코드로 갱신
  // 동작:
  //   1. 로컬에 마지막 새로고침 날짜(YYYY-MM-DD) 저장
  //   2. 앱 로드/포커스/visibility 변경 때마다 현재 날짜와 비교
  //   3. 날짜가 바뀌었으면 (자정 지났음) → 모든 캐시 삭제 + SW 해제 + reload
  //   4. reload 직후 새 날짜로 마킹 → 같은 날 중복 실행 방지
  function todayKey() {
    var d = new Date();
    return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0');
  }
  function checkDailyRefresh() {
    try {
      var key = 'isgolf-last-daily-refresh';
      var stored = localStorage.getItem(key);
      var today = todayKey();
      if (stored === today) return;          // 오늘 이미 새로고침함
      if (!stored) {
        // 최초 설치 — 마킹만 하고 새로고침은 안 함
        localStorage.setItem(key, today);
        return;
      }
      // 다른 날짜 발견 → 자정 지났음. 캐시 삭제 후 reload.
      localStorage.setItem(key, today);      // 먼저 마킹 — reload 후 무한루프 방지
      // SW 해제 + 모든 캐시 삭제 → reload
      var jobs = [];
      if ('serviceWorker' in navigator) {
        jobs.push(navigator.serviceWorker.getRegistrations().then(function(rs){
          return Promise.all(rs.map(function(r){ return r.unregister(); }));
        }));
      }
      if (typeof caches !== 'undefined') {
        jobs.push(caches.keys().then(function(ks){
          return Promise.all(ks.map(function(k){ return caches.delete(k); }));
        }));
      }
      Promise.all(jobs).catch(function(){}).then(function(){
        // 캐시 무시 reload — bfcache 우회
        window.location.reload();
      });
    } catch (err) {}
  }
  // 페이지 로드 시 1번 + visibilitychange/focus 마다 검사
  checkDailyRefresh();
  document.addEventListener('visibilitychange', function() {
    if (document.visibilityState === 'visible') checkDailyRefresh();
  });
  window.addEventListener('focus', checkDailyRefresh);
  // 앱이 계속 열려 있을 때를 위해 — 자정 직후 자동 트리거 (5분 간격 폴링)
  setInterval(checkDailyRefresh, 5 * 60 * 1000);
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
      if (!e.data) return;
      if (e.data.type === 'SW_ACTIVATED' && !refreshing && !onInstallPage) {
        refreshing = true; window.location.reload();
        return;
      }
      // 푸시 알림 클릭으로 특정 URL 이동 요청 (SW 가 navigate 실패 시 fallback)
      if (e.data.type === 'NOTIFICATION_OPEN' && e.data.url) {
        try {
          var u = new URL(e.data.url, window.location.origin);
          if (window.location.pathname !== u.pathname) {
            window.location.href = u.toString();
          } else {
            // 같은 페이지면 새로고침으로 최신 데이터 반영
            window.location.reload();
          }
        } catch (err) {}
      }
    });

    // 앱이 포커스/표시될 때 뱃지 카운트 클리어 — 본 알림을 다 본 것으로 간주
    function clearBadge() {
      try {
        if ('clearAppBadge' in navigator) { navigator.clearAppBadge(); }
        if (navigator.serviceWorker.controller) {
          navigator.serviceWorker.controller.postMessage({ type: 'CLEAR_BADGE', closeAll: false });
        }
      } catch (err) {}
    }
    document.addEventListener('visibilitychange', function() {
      if (document.visibilityState === 'visible') clearBadge();
    });
    window.addEventListener('focus', clearBadge);
    // 페이지 로드 시에도 한 번 클리어 (앱 들어왔으니 본 것)
    clearBadge();
  });
})();
        ` }} />
      </body>
    </html>
  )
}
