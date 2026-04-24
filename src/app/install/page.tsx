'use client'
import { useEffect, useState, useCallback } from 'react'

type Browser = 'chrome' | 'samsung' | 'safari' | 'other'
type Phase   = 'loading' | 'ready' | 'installed'

export default function InstallPage() {
  const [phase,      setPhase]      = useState<Phase>('loading')
  const [browser,    setBrowser]    = useState<Browser>('chrome')
  const [hasPrompt,  setHasPrompt]  = useState(false)
  const [installing, setInstalling] = useState(false)
  const [appUrl,     setAppUrl]     = useState('')
  const [copied,     setCopied]     = useState(false)

  useEffect(() => {
    const url = window.location.origin
    setAppUrl(url)
    const ua = navigator.userAgent

    // ── 브라우저 감지 ──
    const isIOS = /iPhone|iPad|iPod/i.test(ua) && !(window as any).MSStream
    if (/SamsungBrowser/i.test(ua)) setBrowser('samsung')
    else if (isIOS && /Safari/i.test(ua) && !/CriOS|FxiOS/i.test(ua)) setBrowser('safari')
    else if (/Chrome/i.test(ua) && !/EdgA|OPR/i.test(ua)) setBrowser('chrome')
    else setBrowser('other')

    // ── 이미 설치됨 ──
    if (
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true ||
      localStorage.getItem('pwa-installed') === '1'
    ) { setPhase('installed'); return }

    // ── beforeinstallprompt 수신 (layout 인라인 + 여기서 직접) ──
    const grab = (e: Event) => {
      e.preventDefault()
      ;(window as any).__pwaPrompt = e
      setHasPrompt(true)
    }
    window.addEventListener('beforeinstallprompt', grab as EventListener)
    window.addEventListener('pwa:installable', () => setHasPrompt(true))
    window.addEventListener('pwa:installed',   () => setPhase('installed'))

    if ((window as any).__pwaPrompt) setHasPrompt(true)
    setPhase('ready')

    // 혹시 늦게 오는 경우 대비 — 3초 후 재확인
    const t = setTimeout(() => { if ((window as any).__pwaPrompt) setHasPrompt(true) }, 3000)
    return () => { clearTimeout(t); window.removeEventListener('beforeinstallprompt', grab as EventListener) }
  }, [])

  const doInstall = useCallback(async () => {
    const p = (window as any).__pwaPrompt
    if (!p) return
    setInstalling(true)
    try {
      await p.prompt()
      const { outcome } = await p.userChoice
      if (outcome === 'accepted') { ;(window as any).__pwaPrompt = null; setPhase('installed') }
    } finally { setInstalling(false) }
  }, [])

  const copyUrl = () => {
    const u = appUrl + '/install'
    navigator.clipboard?.writeText(u).catch(() => {
      const t = document.createElement('textarea'); t.value = u
      document.body.appendChild(t); t.select(); document.execCommand('copy'); document.body.removeChild(t)
    })
    setCopied(true); setTimeout(() => setCopied(false), 2500)
  }

  // ── 설치 완료 ──────────────────────────────────────────────────────────────
  if (phase === 'installed') return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6">
      <div className="relative w-24 h-24 mb-6">
        <div className="absolute inset-0 bg-green-500/30 rounded-full blur-xl" />
        <div className="relative w-24 h-24 bg-green-600 rounded-full flex items-center justify-center shadow-2xl">
          <span className="text-5xl">✓</span>
        </div>
      </div>
      <h1 className="text-2xl font-extrabold text-white mb-3">설치 완료!</h1>
      <p className="text-gray-400 text-sm text-center mb-10">홈 화면 아이콘을 탭해서 앱을 실행하세요.</p>
      <a href="/login" className="w-full max-w-xs flex items-center justify-center py-4 rounded-2xl font-bold text-white"
        style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 6px 24px rgba(22,163,74,0.45)' }}>
        앱 시작하기 →
      </a>
    </div>
  )

  // ── 로딩 ──────────────────────────────────────────────────────────────────
  if (phase === 'loading') return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-16 h-16 bg-green-700 rounded-2xl flex items-center justify-center animate-pulse">
        <span className="text-3xl">⛳</span>
      </div>
    </div>
  )

  // ── 아이콘 헤더 ────────────────────────────────────────────────────────────
  const AppIcon = () => (
    <div className="flex flex-col items-center mb-6">
      <div className="relative w-24 h-24 mb-4">
        <div className="absolute inset-0 bg-green-500/25 rounded-[28px] blur-2xl" />
        <div className="relative w-24 h-24 bg-gradient-to-br from-green-400 to-green-800 rounded-[28px] flex items-center justify-center shadow-2xl">
          <span className="text-5xl">⛳</span>
        </div>
      </div>
      <h1 className="text-2xl font-extrabold text-white">Inter Stellar GOLF</h1>
      <p className="text-sm text-gray-500 mt-1">골프 모임 관리 앱</p>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // CASE A: beforeinstallprompt 있음 → 원터치 자동 설치
  // ══════════════════════════════════════════════════════════════════════════
  if (hasPrompt) return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <AppIcon />
        <p className="text-gray-400 text-sm text-center leading-relaxed">
          버튼 한 번으로<br/>
          <span className="text-white font-semibold">홈 화면에 앱 아이콘이 바로 생성</span>됩니다
        </p>
      </div>
      <div className="px-4 pb-12 pt-4 space-y-2">
        <button
          onClick={doInstall}
          disabled={installing}
          className="w-full flex items-center justify-center gap-3 text-white font-black text-xl py-5 rounded-2xl disabled:opacity-60 active:scale-[0.97] transition-all"
          style={{
            background: installing ? 'rgba(22,163,74,0.5)' : 'linear-gradient(135deg,#16a34a,#22c55e)',
            boxShadow: installing ? 'none' : '0 8px 36px rgba(22,163,74,0.55)',
          }}>
          {installing ? <><span className="animate-spin text-2xl">⏳</span> 설치 중...</> : <><span className="text-2xl">📲</span> 지금 설치하기</>}
        </button>
        <p className="text-center text-xs text-gray-600">탭 한 번으로 홈 화면에 아이콘이 추가됩니다</p>
      </div>
    </div>
  )

  // ══════════════════════════════════════════════════════════════════════════
  // CASE B: 자동 설치 불가 → 브라우저별 메뉴 안내 (인라인, 탭 없이 바로 표시)
  // ══════════════════════════════════════════════════════════════════════════

  // Chrome
  if (browser === 'chrome') return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center px-5 pt-10 pb-10 overflow-y-auto">
      <AppIcon />

      {/* 안내 타이틀 */}
      <div className="w-full max-w-xs mb-4 rounded-2xl px-4 py-3 text-center"
        style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(96,165,250,0.3)' }}>
        <p className="text-blue-300 font-bold text-sm">Chrome 메뉴에서 홈 화면 추가</p>
        <p className="text-blue-400/60 text-xs mt-0.5">아래 순서대로 따라하세요</p>
      </div>

      {/* 스텝 */}
      <div className="w-full max-w-xs space-y-2.5 mb-5">
        {[
          { title: '화면 오른쪽 상단 ⋮ 탭', desc: 'Chrome 주소창 옆 점 3개 버튼', icon: '⋮' },
          { title: '"홈 화면에 추가" 탭',   desc: '메뉴가 열리면 바로 보입니다',   icon: '➕' },
          { title: '팝업에서 "추가" 탭',    desc: '완료! 홈 화면에 아이콘 생성',   icon: '✅' },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
            style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-black"
              style={{ background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff' }}>
              {i + 1}
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-bold">{s.title}</p>
              <p className="text-gray-500 text-xs mt-0.5">{s.desc}</p>
            </div>
            <span className="text-xl">{s.icon}</span>
          </div>
        ))}
      </div>

      {/* 새로고침 → 자동 설치 버튼 시도 */}
      <button onClick={() => window.location.reload()}
        className="w-full max-w-xs py-3.5 rounded-2xl font-bold text-sm mb-2"
        style={{ background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e' }}>
        🔄 새로고침 — 자동 설치 버튼 시도
      </button>
      <p className="text-xs text-gray-600 text-center max-w-xs">
        새로고침하면 "지금 설치하기" 버튼이 나타날 수 있습니다
      </p>
    </div>
  )

  // Samsung Internet
  if (browser === 'samsung') return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center px-5 pt-10 pb-10 overflow-y-auto">
      <AppIcon />

      <div className="w-full max-w-xs mb-4 rounded-2xl px-4 py-3 text-center"
        style={{ background: 'rgba(59,130,246,0.1)', border: '1px solid rgba(96,165,250,0.3)' }}>
        <p className="text-blue-300 font-bold text-sm">Samsung Internet 메뉴에서 홈 화면 추가</p>
        <p className="text-blue-400/60 text-xs mt-0.5">아래 순서대로 따라하세요</p>
      </div>

      <div className="w-full max-w-xs space-y-2.5 mb-5">
        {[
          { title: '하단 우측 ≡ 메뉴 탭',           desc: '탭바 오른쪽 끝 버튼',     icon: '≡' },
          { title: '"페이지 추가" → "홈 화면" 탭',   desc: '홈 화면에 추가 선택',      icon: '➕' },
          { title: '"추가" 탭',                       desc: '완료! 홈 화면에 아이콘',   icon: '✅' },
        ].map((s, i) => (
          <div key={i} className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
            style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
            <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-black"
              style={{ background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff' }}>
              {i + 1}
            </div>
            <div className="flex-1">
              <p className="text-white text-sm font-bold">{s.title}</p>
              <p className="text-gray-500 text-xs mt-0.5">{s.desc}</p>
            </div>
            <span className="text-xl">{s.icon}</span>
          </div>
        ))}
      </div>

      <button onClick={() => window.location.reload()}
        className="w-full max-w-xs py-3.5 rounded-2xl font-bold text-sm"
        style={{ background: 'rgba(22,163,74,0.12)', border: '1px solid rgba(34,197,94,0.25)', color: '#22c55e' }}>
        🔄 새로고침 — 자동 설치 버튼 시도
      </button>
    </div>
  )

  // iOS Safari
  if (browser === 'safari') return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="flex-1 flex flex-col items-center px-5 pt-10 pb-4 overflow-y-auto">
        <AppIcon />
        <p className="text-gray-400 text-sm text-center mb-5">
          아래 순서대로 3번만 탭하면<br/>홈 화면에 앱이 설치됩니다
        </p>
        <div className="w-full max-w-xs space-y-2.5">
          {[
            { title: '하단 공유 버튼 □↑ 탭',     desc: 'Safari 화면 하단 중앙 버튼',     icon: '⬆️' },
            { title: '"홈 화면에 추가" 탭',       desc: '아래로 스크롤하면 보입니다',       icon: '➕' },
            { title: '오른쪽 상단 "추가" 탭',     desc: '완료! 홈 화면에 아이콘 생성',     icon: '✅' },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
              style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <div className="flex-shrink-0 w-9 h-9 rounded-full flex items-center justify-center font-black"
                style={{ background: 'linear-gradient(135deg,#16a34a,#14532d)', color: '#fff' }}>
                {i + 1}
              </div>
              <div className="flex-1">
                <p className="text-white text-sm font-bold">{s.title}</p>
                <p className="text-gray-500 text-xs mt-0.5">{s.desc}</p>
              </div>
              <span className="text-xl">{s.icon}</span>
            </div>
          ))}
        </div>
      </div>
      <div className="flex flex-col items-center pb-8 pt-2">
        <div className="text-3xl animate-bounce">⬇️</div>
        <p className="text-xs text-gray-600">Safari 하단 공유 버튼 (□↑)</p>
      </div>
    </div>
  )

  // 기타 브라우저 (Chrome으로 열도록 안내)
  return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center px-5 pt-10 pb-10 overflow-y-auto">
      <AppIcon />

      <div className="w-full max-w-xs mb-5 rounded-2xl px-4 py-3 text-center"
        style={{ background: 'rgba(234,179,8,0.1)', border: '1px solid rgba(234,179,8,0.3)' }}>
        <p className="text-yellow-300 font-bold text-sm">Chrome에서 열어주세요</p>
        <p className="text-yellow-400/60 text-xs mt-0.5">앱 설치는 Chrome 또는 Safari에서만 가능합니다</p>
      </div>

      <div className="w-full max-w-xs bg-gray-800/80 rounded-xl px-4 py-3 text-center mb-4">
        <p className="text-xs text-gray-500 mb-1.5">Chrome 주소창에 이 주소 입력:</p>
        <p className="text-green-400 text-sm font-mono break-all mb-3">{appUrl}/install</p>
        <button onClick={copyUrl}
          className="text-xs font-bold px-4 py-2 rounded-full"
          style={{
            background: copied ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.07)',
            color: copied ? '#22c55e' : '#9ca3af',
            border: `1px solid ${copied ? 'rgba(34,197,94,0.4)' : 'rgba(255,255,255,0.1)'}`,
          }}>
          {copied ? '✓ 복사됨!' : '📋 주소 복사'}
        </button>
      </div>
    </div>
  )
}
