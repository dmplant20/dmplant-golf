import { NextRequest, NextResponse } from 'next/server'

// ── WebView 판별 패턴 ────────────────────────────────────────────────────────
const WEBVIEW_RE = /FBAN|FBAV|Instagram|KAKAOTALK|kakaotalk|com\.kakao\.talk|Line\/|NaverApp|NAVER| wv[);\s]|WebView| GSA\/|MicroMessenger|Twitter\/|Snapchat|TikTok|Musical\.ly|Bytedance|DaumApps|everytime/i

// ── 앱별 외부 브라우저 열기 안내 ──────────────────────────────────────────────
function detectApp(ua: string): 'kakao' | 'instagram' | 'facebook' | 'naver' | 'line' | 'other' {
  if (/KAKAOTALK|kakaotalk|com\.kakao\.talk/i.test(ua)) return 'kakao'
  if (/Instagram/i.test(ua)) return 'instagram'
  if (/FBAN|FBAV/i.test(ua)) return 'facebook'
  if (/NaverApp|NAVER/i.test(ua)) return 'naver'
  if (/Line\//i.test(ua)) return 'line'
  return 'other'
}

function makeRedirectPage(targetUrl: string, ua: string): string {
  const encoded    = encodeURIComponent(targetUrl)
  const host       = targetUrl.replace(/^https?:\/\//, '')
  const appType    = detectApp(ua)

  // intent:// — Chrome 우선, Samsung Internet 폴백
  const chromeIntent  = `intent://${host}#Intent;scheme=https;package=com.android.chrome;S.browser_fallback_url=${encoded};end`
  const samsungIntent = `intent://${host}#Intent;scheme=https;package=com.sec.android.app.sbrowser;S.browser_fallback_url=${encoded};end`

  // 앱별 안내 텍스트
  const appGuides: Record<string, { name: string; steps: string[] }> = {
    kakao: {
      name: '카카오톡',
      steps: [
        '화면 <strong>우측 하단 ⋮ (더보기)</strong> 버튼 탭',
        '<strong>"다른 브라우저로 열기"</strong> 또는 <strong>"기본 브라우저로 열기"</strong> 선택',
      ],
    },
    instagram: {
      name: 'Instagram',
      steps: [
        '화면 <strong>우측 상단 ⋮</strong> 버튼 탭',
        '<strong>"브라우저에서 열기"</strong> 선택',
      ],
    },
    facebook: {
      name: 'Facebook',
      steps: [
        '화면 <strong>우측 상단 ⋮</strong> 버튼 탭',
        '<strong>"외부 브라우저에서 열기"</strong> 선택',
      ],
    },
    naver: {
      name: '네이버',
      steps: [
        '화면 <strong>우측 상단 ⋮</strong> 버튼 탭',
        '<strong>"외부 브라우저로 열기"</strong> 선택',
      ],
    },
    line: {
      name: 'Line',
      steps: [
        '화면 <strong>우측 상단 ⋯</strong> 버튼 탭',
        '<strong>"외부 브라우저에서 열기"</strong> 선택',
      ],
    },
    other: {
      name: '앱',
      steps: [
        '화면 <strong>우측 상단 메뉴(⋮)</strong> 버튼 탭',
        '<strong>"외부 브라우저로 열기"</strong> 선택',
      ],
    },
  }

  const guide = appGuides[appType] ?? appGuides.other
  const stepsHtml = guide.steps
    .map((s, i) => `<div class="step"><div class="step-num">${i + 1}</div><div>${s}</div></div>`)
    .join('')

  // QR코드 URL (qrserver.com 무료 API)
  const qrUrl = `https://api.qrserver.com/v1/create-qr-code/?size=180x180&bgcolor=060d06&color=22c55e&data=${encoded}`

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1, user-scalable=no">
  <title>앱 외부 브라우저로 열기</title>
  <style>
    *{margin:0;padding:0;box-sizing:border-box}
    body{
      background:#060d06;color:#f0fdf4;
      font-family:-apple-system,'Apple SD Gothic Neo','Noto Sans KR',sans-serif;
      min-height:100vh;display:flex;flex-direction:column;align-items:center;
      justify-content:flex-start;padding:20px 20px 40px;
    }
    .logo{font-size:52px;margin:24px 0 8px}
    h1{font-size:18px;font-weight:800;color:#fff;text-align:center;margin-bottom:4px}
    .sub{font-size:13px;color:#4d7a4d;text-align:center;margin-bottom:24px}

    /* 방법1: 앱 내 메뉴 */
    .card{
      width:100%;max-width:360px;border-radius:20px;padding:18px;margin-bottom:14px;
      background:rgba(22,163,74,0.08);border:1px solid rgba(34,197,94,0.25);
    }
    .card-title{
      font-size:13px;font-weight:700;color:#22c55e;
      display:flex;align-items:center;gap:6px;margin-bottom:12px;
    }
    .badge{
      background:rgba(34,197,94,0.2);color:#22c55e;
      font-size:10px;font-weight:700;padding:2px 7px;border-radius:99px;
    }
    .step{display:flex;align-items:flex-start;gap:10px;margin-bottom:10px;font-size:13px;color:#d1fae5;line-height:1.5}
    .step:last-child{margin-bottom:0}
    .step-num{
      flex-shrink:0;width:22px;height:22px;border-radius:50%;
      background:linear-gradient(135deg,#16a34a,#14532d);
      color:#fff;font-size:11px;font-weight:800;
      display:flex;align-items:center;justify-content:center;margin-top:1px;
    }
    .step strong{color:#fff}

    /* 방법2: Chrome 버튼 */
    .btn{
      display:flex;align-items:center;justify-content:center;gap:8px;
      width:100%;max-width:360px;
      background:linear-gradient(135deg,#16a34a,#14532d);color:#fff;
      font-size:15px;font-weight:800;padding:15px;
      border-radius:16px;text-decoration:none;margin-bottom:10px;
      border:none;cursor:pointer;
    }
    .btn.secondary{
      background:transparent;border:1px solid rgba(34,197,94,0.3);
      color:#22c55e;font-size:14px;
    }
    .btn.copy-btn{
      background:rgba(255,255,255,0.06);border:1px solid rgba(255,255,255,0.12);
      color:#9ca3af;font-size:13px;padding:12px;
    }
    .btn.copy-btn.copied{border-color:rgba(34,197,94,0.5);color:#22c55e}

    /* 방법3: QR */
    .qr-section{
      width:100%;max-width:360px;border-radius:20px;padding:18px;margin-bottom:14px;
      background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.08);
      text-align:center;
    }
    .qr-title{font-size:13px;font-weight:700;color:#9ca3af;margin-bottom:12px;display:flex;align-items:center;justify-content:center;gap:6px}
    .qr-img{width:140px;height:140px;border-radius:12px;margin:0 auto 10px}
    .qr-desc{font-size:11px;color:#4d7a4d}

    /* URL 박스 */
    .url-box{
      width:100%;max-width:360px;
      background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);
      border-radius:12px;padding:10px 14px;margin-bottom:14px;
      font-size:12px;color:#22c55e;font-family:monospace;word-break:break-all;text-align:center;
    }

    .divider{width:100%;max-width:360px;display:flex;align-items:center;gap:10px;margin:4px 0 14px;color:#3a5a3a;font-size:11px}
    .divider::before,.divider::after{content:'';flex:1;height:1px;background:rgba(255,255,255,0.07)}
  </style>
</head>
<body>
  <div class="logo">⛳</div>
  <h1>Inter Stellar GOLF</h1>
  <p class="sub">${guide.name} 앱 내에서는 실행이 제한됩니다</p>

  <!-- 방법 1: 앱 내 메뉴로 외부 브라우저 열기 -->
  <div class="card">
    <div class="card-title">
      <span>📱 ${guide.name} 메뉴에서 열기</span>
      <span class="badge">추천</span>
    </div>
    ${stepsHtml}
  </div>

  <!-- 방법 2: Chrome 직접 열기 버튼 -->
  <div class="divider">또는</div>

  <a href="${chromeIntent}" class="btn" id="chromeBtn">
    🌐 Chrome으로 바로 열기
  </a>
  <a href="${samsungIntent}" class="btn secondary" style="margin-bottom:14px">
    Samsung Internet으로 열기
  </a>

  <!-- 방법 3: URL 복사 → 브라우저에서 붙여넣기 -->
  <div class="divider">또는</div>

  <div class="url-box" id="urlBox">${targetUrl}</div>
  <button class="btn copy-btn" id="copyBtn" onclick="copyUrl()">
    📋 URL 복사 → 브라우저 주소창에 붙여넣기
  </button>

  <!-- 방법 4: QR 코드 스캔 -->
  <div class="divider">또는</div>

  <div class="qr-section">
    <div class="qr-title">📷 카메라로 QR 스캔하기</div>
    <img src="${qrUrl}" alt="QR Code" class="qr-img" />
    <p class="qr-desc">기기 카메라 앱으로 스캔하면<br>바로 브라우저에서 열립니다</p>
  </div>

  <script>
    // 자동으로 Chrome intent 실행 시도
    setTimeout(function(){
      try{ window.location.replace(${JSON.stringify(chromeIntent)}); }catch(e){}
    }, 600);

    // URL 복사
    function copyUrl(){
      var url = ${JSON.stringify(targetUrl)};
      var btn = document.getElementById('copyBtn');
      if(navigator.clipboard){
        navigator.clipboard.writeText(url).then(function(){
          btn.textContent='✓ 복사됨! 브라우저 주소창에 붙여넣기';
          btn.classList.add('copied');
        });
      } else {
        // fallback: textarea 방식
        var t=document.createElement('textarea');
        t.value=url;document.body.appendChild(t);t.select();
        document.execCommand('copy');document.body.removeChild(t);
        btn.textContent='✓ 복사됨! 브라우저 주소창에 붙여넣기';
        btn.classList.add('copied');
      }
    }
  </script>
</body>
</html>`
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // ── 제외 경로 ──────────────────────────────────────────────────────────────
  if (
    pathname.startsWith('/api/') ||
    pathname.startsWith('/_next/') ||
    pathname.startsWith('/icons/') ||
    pathname === '/sw.js' ||
    pathname === '/manifest.json' ||
    pathname === '/favicon.ico'
    // ※ /install 은 제외하지 않음 — WebView에서도 안내 페이지 표시
  ) {
    return NextResponse.next()
  }

  const ua = request.headers.get('user-agent') || ''
  const isAndroid = /Android/i.test(ua)
  const isIOS     = /iPhone|iPad|iPod/i.test(ua)
  const isWebView = WEBVIEW_RE.test(ua)

  if ((isAndroid || isIOS) && isWebView) {
    const targetUrl = request.url
    return new NextResponse(makeRedirectPage(targetUrl, ua), {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Cache-Control': 'no-store, no-cache',
        'X-Robots-Tag': 'noindex',
      },
    })
  }

  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon\\.ico).*)'],
}
