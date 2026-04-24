'use client'
import { useEffect, useState, useCallback } from 'react'

type OS      = 'android' | 'ios' | 'desktop' | 'unknown'
type Browser = 'chrome' | 'samsung' | 'safari' | 'other'
type Phase   = 'loading' | 'ready' | 'installed'

// 브라우저별 설치 스텝
const STEPS: Record<Browser, { num: string; title: string; desc: string }[]> = {
  chrome: [
    { num: '1', title: '오른쪽 상단 ⋮ 탭',        desc: 'Chrome 주소창 오른쪽 세로 점 3개 버튼' },
    { num: '2', title: '"홈 화면에 추가" 탭',       desc: '메뉴 목록에서 선택' },
    { num: '3', title: '팝업에서 "추가" 탭',        desc: '완료! 홈 화면에 아이콘 생성' },
  ],
  samsung: [
    { num: '1', title: '하단 우측 ≡ 메뉴 탭',      desc: 'Samsung Internet 탭바 오른쪽 끝 버튼' },
    { num: '2', title: '"페이지 추가" → "홈 화면"', desc: '홈 화면에 추가 선택' },
    { num: '3', title: '"추가" 탭',                  desc: '완료! 홈 화면에 아이콘 생성' },
  ],
  safari: [
    { num: '1', title: '하단 공유 버튼 □↑ 탭',      desc: 'Safari 화면 하단 중앙 버튼' },
    { num: '2', title: '"홈 화면에 추가" 탭',        desc: '목록을 아래로 스크롤 후 선택' },
    { num: '3', title: '오른쪽 상단 "추가" 탭',      desc: '완료! 홈 화면에 아이콘 생성' },
  ],
  other: [
    { num: '1', title: 'Chrome 앱에서 열기',         desc: '아래 주소를 Chrome에 붙여넣으세요' },
    { num: '2', title: '오른쪽 상단 ⋮ 탭',          desc: 'Chrome 메뉴' },
    { num: '3', title: '"홈 화면에 추가" 탭',        desc: '완료!' },
  ],
}

const BROWSER_NAME: Record<Browser, string> = {
  chrome:  'Chrome',
  samsung: 'Samsung Internet',
  safari:  'Safari',
  other:   '브라우저',
}

export default function InstallPage() {
  const [phase,      setPhase]      = useState<Phase>('loading')
  const [os,         setOs]         = useState<OS>('unknown')
  const [browser,    setBrowser]    = useState<Browser>('chrome')
  const [hasPrompt,  setHasPrompt]  = useState(false)
  const [installing, setInstalling] = useState(false)
  const [showGuide,  setShowGuide]  = useState(false)
  const [appUrl,     setAppUrl]     = useState('')
  const [copied,     setCopied]     = useState(false)

  useEffect(() => {
    setAppUrl(window.location.origin)
    const ua = navigator.userAgent

    // ── OS 감지 ──
    const isIOS     = /iPhone|iPad|iPod/i.test(ua) && !(window as any).MSStream
    const isAndroid = /Android/i.test(ua)
    const detectedOs: OS = isIOS ? 'ios' : isAndroid ? 'android' : 'desktop'
    setOs(detectedOs)

    // ── 브라우저 감지 ──
    if (/SamsungBrowser/i.test(ua))                           setBrowser('samsung')
    else if (isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS/i.test(ua)) setBrowser('safari')
    else if (/Chrome/i.test(ua) && !/EdgA|OPR/i.test(ua))    setBrowser('chrome')
    else                                                       setBrowser('other')

    // ── 이미 설치됨 ──
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true ||
      localStorage.getItem('pwa-installed') === '1'
    if (standalone) { setPhase('installed'); return }

    // ── beforeinstallprompt 캡처 여부 ──
    if ((window as any).__pwaPrompt) {
      setHasPrompt(true)
    }

    setPhase('ready')

    // pwa:installable 이벤트 수신 (layout.tsx 에서 beforeinstallprompt 캡처 시 dispatch)
    const onInstallable = () => { setHasPrompt(true); setShowGuide(false) }
    const onInstalled   = () => setPhase('installed')
    window.addEventListener('pwa:installable', onInstallable)
    window.addEventListener('pwa:installed',   onInstalled)

    // 직접 beforeinstallprompt 도 여기서 한번 더 수신 (혹시 layout 보다 늦게 바인딩돼도 잡기 위해)
    const onPrompt = (e: Event) => {
      e.preventDefault()
      ;(window as any).__pwaPrompt = e
      setHasPrompt(true)
      setShowGuide(false)
    }
    window.addEventListener('beforeinstallprompt', onPrompt as EventListener)

    return () => {
      window.removeEventListener('pwa:installable',      onInstallable)
      window.removeEventListener('pwa:installed',        onInstalled)
      window.removeEventListener('beforeinstallprompt',  onPrompt as EventListener)
    }
  }, [])

  // ── 설치 버튼 탭 ──
  const handleInstallTap = useCallback(async () => {
    const p = (window as any).__pwaPrompt
    if (p) {
      // ✅ 자동 설치 — 브라우저 다이얼로그 표시
      setInstalling(true)
      try {
        await p.prompt()
        const { outcome } = await p.userChoice
        if (outcome === 'accepted') {
          ;(window as any).__pwaPrompt = null
          setPhase('installed')
        }
      } finally {
        setInstalling(false)
      }
    } else {
      // 브라우저가 아직 설치 허락 안 함 → 브라우저별 수동 안내
      setShowGuide(true)
    }
  }, [])

  // ── URL 복사 ──
  const copyUrl = useCallback(() => {
    const url = appUrl + '/install'
    navigator.clipboard?.writeText(url).catch(() => {
      const t = document.createElement('textarea')
      t.value = url; document.body.appendChild(t); t.select()
      document.execCommand('copy'); document.body.removeChild(t)
    })
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }, [appUrl])

  // ── 설치 완료 화면 ──
  if (phase === 'installed') return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 pb-16">
      <div className="relative mx-auto w-24 h-24 mb-6">
        <div className="absolute inset-0 bg-green-500/30 rounded-full blur-xl" />
        <div className="relative w-24 h-24 bg-green-600 rounded-full flex items-center justify-center shadow-2xl">
          <span className="text-5xl">✓</span>
        </div>
      </div>
      <h1 className="text-2xl font-extrabold text-white mb-3">설치 완료!</h1>
      <p className="text-gray-400 text-sm text-center mb-10">
        홈 화면에 IS Golf 아이콘이 생성됐습니다.<br />아이콘을 탭해서 앱을 실행하세요.
      </p>
      <a href="/login"
        className="w-full max-w-xs flex items-center justify-center py-4 rounded-2xl font-bold text-white text-base"
        style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 6px 24px rgba(22,163,74,0.45)' }}>
        앱 시작하기 →
      </a>
    </div>
  )

  // ── 로딩 ──
  if (phase === 'loading') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-16 h-16 bg-green-700 rounded-2xl flex items-center justify-center animate-pulse">
        <span className="text-3xl">⛳</span>
      </div>
    </div>
  )

  // ── 설치 준비 화면 (android / ios / desktop 공통) ──
  const steps   = STEPS[browser]
  const btnName = BROWSER_NAME[browser]

  return (
    <div className="min-h-screen bg-gray-950 flex flex-col">

      {/* 본문 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-4">

        {/* 아이콘 */}
        <div className="relative mx-auto w-28 h-28 mb-5">
          <div className="absolute inset-0 bg-green-500/25 rounded-[32px] blur-2xl" />
          <div className="relative w-28 h-28 bg-gradient-to-br from-green-400 to-green-800 rounded-[32px] flex items-center justify-center shadow-2xl shadow-green-900/60">
            <span className="text-6xl">⛳</span>
          </div>
        </div>

        <h1 className="text-2xl font-extrabold text-white tracking-tight mb-1">Inter Stellar GOLF</h1>
        <p className="text-sm text-gray-500 mb-8">골프 모임 관리 앱</p>

        {/* 혜택 배지 */}
        <div className="flex gap-2 mb-8 flex-wrap justify-center">
          {['오프라인 사용 가능', '빠른 실행', '홈 화면 아이콘'].map(b => (
            <span key={b} className="text-xs font-semibold px-3 py-1 rounded-full"
              style={{ background: 'rgba(22,163,74,0.15)', color: '#4ade80', border: '1px solid rgba(34,197,94,0.2)' }}>
              ✓ {b}
            </span>
          ))}
        </div>

        {/* 자동 설치 가능 배지 */}
        {hasPrompt && (
          <div className="mb-4 px-4 py-2 rounded-full text-xs font-bold"
            style={{ background: 'rgba(34,197,94,0.15)', color: '#22c55e', border: '1px solid rgba(34,197,94,0.3)' }}>
            ✦ 원터치 자동 설치 준비됨
          </div>
        )}
      </div>

      {/* 하단 설치 버튼 */}
      <div className="px-4 pb-10 pt-2 space-y-3">
        <button
          onClick={handleInstallTap}
          disabled={installing}
          className="w-full flex items-center justify-center gap-3 text-white font-black text-xl py-5 rounded-2xl disabled:opacity-60 transition-all active:scale-[0.97]"
          style={{
            background: installing
              ? 'rgba(22,163,74,0.5)'
              : 'linear-gradient(135deg,#16a34a 0%,#22c55e 100%)',
            boxShadow: installing ? 'none' : '0 8px 36px rgba(22,163,74,0.55)',
          }}
        >
          {installing
            ? <><span className="animate-spin text-2xl">⏳</span> 설치 중...</>
            : <><span className="text-2xl">📲</span> 앱 설치하기</>
          }
        </button>
        <p className="text-center text-xs text-gray-600">
          {hasPrompt
            ? '탭 한 번으로 홈 화면에 아이콘이 추가됩니다'
            : '탭하면 설치 방법 안내가 표시됩니다'}
        </p>
      </div>

      {/* ── 수동 설치 가이드 바텀시트 ── */}
      {showGuide && (
        <>
          {/* 딤 오버레이 */}
          <div
            className="fixed inset-0 bg-black/70 z-40"
            onClick={() => setShowGuide(false)}
          />

          {/* 시트 */}
          <div
            className="fixed bottom-0 left-0 right-0 z-50 rounded-t-3xl px-5 pt-5 pb-10"
            style={{ background: '#0d1a0d', border: '1px solid rgba(34,197,94,0.2)' }}
          >
            {/* 핸들 */}
            <div className="w-10 h-1 bg-gray-700 rounded-full mx-auto mb-5" />

            <h2 className="text-white font-extrabold text-lg mb-1 text-center">
              {btnName}에서 홈 화면 추가
            </h2>
            <p className="text-gray-500 text-xs text-center mb-1">
              아래 순서대로 3번만 탭 — 30초 완료
            </p>
            <p className="text-yellow-500/80 text-xs text-center mb-5">
              ※ 브라우저가 설치 허용 전이라 수동으로 추가합니다
            </p>

            {/* 스텝 */}
            <div className="space-y-2.5 mb-5">
              {steps.map((s) => (
                <div key={s.num} className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
                  style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(34,197,94,0.18)' }}>
                  <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-black text-base"
                    style={{ background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff' }}>
                    {s.num}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm font-bold leading-tight">{s.title}</p>
                    <p className="text-gray-500 text-xs mt-0.5">{s.desc}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* URL 복사 (other 브라우저용) */}
            {browser === 'other' && (
              <div className="mb-4 rounded-xl bg-gray-800/80 px-4 py-3 text-center">
                <p className="text-xs text-gray-500 mb-1.5">Chrome 주소창에 이 주소 입력:</p>
                <p className="text-green-400 text-sm font-mono break-all mb-2">{appUrl}/install</p>
                <button
                  onClick={copyUrl}
                  className="text-xs font-bold px-4 py-1.5 rounded-full transition"
                  style={{
                    background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.07)',
                    color: copied ? '#22c55e' : '#9ca3af',
                    border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
                  }}
                >
                  {copied ? '✓ 복사됨!' : '📋 주소 복사'}
                </button>
              </div>
            )}

            {/* 새로고침 힌트 */}
            <button
              onClick={() => window.location.reload()}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm mb-3"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.09)', color: '#6b7280' }}
            >
              🔄 새로고침 — 자동 설치 버튼이 나타날 수 있습니다
            </button>

            <button
              onClick={() => setShowGuide(false)}
              className="w-full py-3 rounded-2xl font-bold text-sm"
              style={{ background: 'rgba(22,163,74,0.12)', color: '#22c55e' }}
            >
              닫기
            </button>
          </div>
        </>
      )}
    </div>
  )
}
