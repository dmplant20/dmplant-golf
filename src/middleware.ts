import { NextRequest, NextResponse } from 'next/server'

// ── WebView 판별 패턴 (Android 인앱 브라우저) ────────────────────────────────
// 이 브라우저들은 Google의 disallowed_useragent 정책에 의해 차단됩니다.
const WEBVIEW_PATTERNS = [
  'FBAN', 'FBAV',          // Facebook
  'Instagram',              // Instagram
  'KAKAOTALK', 'kakaotalk',// 카카오톡
  'Line/',                  // Line
  'NaverApp', 'NAVER',      // 네이버 앱
  ' wv)',                   // Android 범용 WebView
  'WebView',                // 범용 WebView
  ' GSA/',                  // Google Search App
  'MicroMessenger',         // 위챗
  'Twitter/',               // 트위터
  'Snapchat',               // 스냅챗
  'TikTok',                 // 틱톡
  'Musical.ly',             // 뮤지컬리
  'Bytedance',              // ByteDance 계열
]

// ── Chrome으로 리다이렉트하는 HTML 페이지 ────────────────────────────────────
function makeRedirectPage(targetUrl: string): string {
  const encoded = encodeURIComponent(targetUrl)
  const intentUrl =
    'intent://' +
    targetUrl.replace(/^https?:\/\//, '') +
    '#Intent;scheme=https;package=com.android.chrome;' +
    'S.browser_fallback_url=' + encoded + ';end'

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Chrome으로 열기</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      background: #060d06;
      color: #f0fdf4;
      font-family: -apple-system, 'Apple SD Gothic Neo', 'Noto Sans KR', sans-serif;
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 24px;
      text-align: center;
    }
    .icon { font-size: 64px; margin-bottom: 20px; }
    h1 { font-size: 20px; font-weight: 700; margin-bottom: 8px; }
    p  { font-size: 14px; color: #5a7a5a; line-height: 1.6; margin-bottom: 24px; }
    .btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: #16a34a;
      color: #fff;
      font-size: 15px;
      font-weight: 700;
      padding: 14px 28px;
      border-radius: 14px;
      text-decoration: none;
      margin-bottom: 16px;
      width: 100%;
      max-width: 300px;
      justify-content: center;
    }
    .btn2 {
      background: transparent;
      border: 1px solid rgba(34,197,94,0.3);
      color: #22c55e;
    }
    .note { font-size: 12px; color: #3a5a3a; margin-top: 16px; }
  </style>
  <script>
    // 자동으로 Chrome intent URL 실행 시도
    window.onload = function() {
      var intent = ${JSON.stringify(intentUrl)};
      var target = ${JSON.stringify(targetUrl)};
      // 0.5초 후 intent 실행 (바로 실행하면 차단될 수 있음)
      setTimeout(function() {
        try { window.location.replace(intent); } catch(e) {}
      }, 500);
    };
  </script>
</head>
<body>
  <div class="icon">⛳</div>
  <h1>Chrome에서 열어주세요</h1>
  <p>
    카카오톡·Gmail 등 앱 내 브라우저에서는<br>
    Google 정책으로 인해 앱이 실행되지 않습니다.<br>
    아래 버튼을 눌러 Chrome에서 열어주세요.
  </p>

  <a href="${intentUrl}" class="btn">
    🌐 Chrome으로 열기
  </a>

  <a href="${targetUrl}" class="btn btn2">
    현재 브라우저에서 계속
  </a>

  <p class="note">
    Chrome이 설치되어 있지 않으면<br>
    기기의 기본 브라우저로 열립니다.
  </p>
</body>
</html>`
}

export function middleware(request: NextRequest) {
  // API 경로·정적 파일·SW는 제외
  const { pathname } = request.nextUrl
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/icons/') ||
    pathname === '/sw.js' ||
    pathname === '/manifest.json' ||
    pathname === '/favicon.ico' ||
    pathname === '/install'        // /install 페이지 자체는 제외
  ) {
    return NextResponse.next()
  }

  const ua = request.headers.get('user-agent') || ''
  const isAndroid  = /Android/i.test(ua)
  const isWebView  = WEBVIEW_PATTERNS.some(p => ua.includes(p))

  if (isAndroid && isWebView) {
    const targetUrl = request.url
    return new NextResponse(makeRedirectPage(targetUrl), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store',
      },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    /*
     * 모든 경로에 적용. 단, 다음은 제외:
     * - API routes (/api/...)
     * - Static files (_next/static, _next/image, public files)
     */
    '/((?!_next/static|_next/image|favicon\\.ico).*)',
  ],
}
