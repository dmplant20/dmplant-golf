'use client'
import { useEffect, useState, useCallback } from 'react'

type Phase = 'loading' | 'android-ready' | 'android-waiting' | 'ios' | 'ios-nosafari' | 'installed' | 'desktop'

export default function InstallPage() {
  const [phase,      setPhase]      = useState<Phase>('loading')
  const [installing, setInstalling] = useState(false)
  const [appUrl,     setAppUrl]     = useState('')

  // 설치 실행
  const doInstall = useCallback(async () => {
    const p = (window as any).__pwaPrompt
    if (!p) return
    setInstalling(true)
    try {
      p.prompt()
      const { outcome } = await p.userChoice
      if (outcome === 'accepted') {
        ;(window as any).__pwaPrompt = null
        setPhase('installed')
      }
    } finally {
      setInstalling(false)
    }
  }, [])

  useEffect(() => {
    setAppUrl(window.location.origin)
    const ua = navigator.userAgent

    // 이미 설치됨
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true ||
      localStorage.getItem('pwa-installed') === '1'
    if (standalone) { setPhase('installed'); return }

    const isIOS     = /iPhone|iPad|iPod/i.test(ua) && !(window as any).MSStream
    const isAndroid = /Android/i.test(ua)

    if (isIOS) {
      // Safari 여부 (Chrome/CriOS는 iOS에서 설치 불가)
      const isSafari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)
      setPhase(isSafari ? 'ios' : 'ios-nosafari')
      return
    }

    if (!isAndroid) {
      setPhase('desktop')
      return
    }

    // Android: 이미 캡처된 prompt 확인
    if ((window as any).__pwaPrompt) {
      setPhase('android-ready')
      return
    }

    // 아직 이벤트가 안 왔으면 대기
    setPhase('android-waiting')
    const onInstallable = () => setPhase('android-ready')
    const onInstalled   = () => setPhase('installed')
    window.addEventListener('pwa:installable', onInstallable)
    window.addEventListener('pwa:installed',   onInstalled)
    return () => {
      window.removeEventListener('pwa:installable', onInstallable)
      window.removeEventListener('pwa:installed',   onInstalled)
    }
  }, [])

  // ── 공통 헤더 ──────────────────────────────────────────────────────────
  const Header = () => (
    <div className="text-center mb-8">
      <div className="relative mx-auto w-24 h-24 mb-5">
        <div className="absolute inset-0 bg-green-500/20 rounded-[28px] blur-xl" />
        <div className="relative w-24 h-24 bg-gradient-to-br from-green-500 to-green-800 rounded-[28px] flex items-center justify-center shadow-2xl shadow-green-900/60">
          <span className="text-5xl">⛳</span>
        </div>
      </div>
      <h1 className="text-2xl font-extrabold text-white tracking-tight">Inter Stellar GOLF</h1>
      <p className="text-sm text-gray-500 mt-1">골프 모임 관리 앱</p>
    </div>
  )

  // ── 설치 완료 ──────────────────────────────────────────────────────────
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

  // ── Android: 설치 준비됨 (원터치) ─────────────────────────────────────
  if (phase === 'android-ready') return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      {/* 상단 여백 + 헤더 */}
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <Header />
        <p className="text-gray-400 text-sm text-center leading-relaxed max-w-xs">
          아래 버튼 하나만 누르면<br />
          <span className="text-white font-semibold">홈 화면에 앱 아이콘이 생성</span>됩니다.
        </p>
      </div>

      {/* 하단 — 설치 버튼 (전체 너비) */}
      <div className="px-4 pb-12 pt-4 space-y-3">
        <button
          onClick={doInstall}
          disabled={installing}
          className="w-full flex items-center justify-center gap-3 text-white font-black text-xl py-5 rounded-2xl disabled:opacity-60 transition active:scale-[0.97]"
          style={{
            background: installing
              ? 'rgba(22,163,74,0.5)'
              : 'linear-gradient(135deg,#16a34a 0%,#22c55e 100%)',
            boxShadow: installing ? 'none' : '0 8px 32px rgba(22,163,74,0.55)',
          }}
        >
          {installing ? (
            <><span className="animate-spin text-2xl">⏳</span> 설치 중...</>
          ) : (
            <><span className="text-2xl">📲</span> 지금 설치하기</>
          )}
        </button>
        <p className="text-center text-xs text-gray-600">탭 한 번으로 홈 화면에 아이콘이 추가됩니다</p>
      </div>
    </div>
  )

  // ── Android: prompt 대기 중 ────────────────────────────────────────────
  if (phase === 'android-waiting') return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6">
      <Header />
      <div className="w-full max-w-xs space-y-4">
        <div className="glass-card rounded-2xl p-5 text-center space-y-3">
          <p className="text-white font-semibold">Chrome 브라우저에서 열어주세요</p>
          <p className="text-gray-400 text-sm">앱 설치는 Chrome에서만 가능합니다.</p>
          <div className="bg-gray-800 rounded-xl px-4 py-3">
            <p className="text-xs text-gray-500 mb-1">Chrome 주소창에 입력:</p>
            <p className="text-green-400 text-sm font-mono break-all">{appUrl}/install</p>
          </div>
        </div>
        <p className="text-center text-xs text-gray-600">
          Chrome에서 이미 열려 있다면 잠시 기다려 주세요…
        </p>
      </div>
    </div>
  )

  // ── iOS Safari: 3단계 안내 ─────────────────────────────────────────────
  if (phase === 'ios') return (
    <div className="min-h-screen bg-gray-950 flex flex-col">
      <div className="flex-1 flex flex-col items-center justify-center px-6">
        <Header />
        <p className="text-gray-400 text-sm text-center mb-6">
          아래 순서대로 3번만 탭하면<br />홈 화면에 앱이 설치됩니다.
        </p>
        <div className="w-full max-w-xs space-y-3">
          {[
            { icon: '⬆️', title: '공유 버튼 탭', desc: 'Safari 하단 중앙의 □↑ 버튼' },
            { icon: '➕', title: '"홈 화면에 추가" 탭', desc: '목록을 아래로 스크롤하면 보입니다' },
            { icon: '✅', title: '오른쪽 상단 "추가" 탭', desc: '완료! 홈 화면에 아이콘이 생깁니다' },
          ].map((s, i) => (
            <div key={i} className="flex items-center gap-3 rounded-2xl px-4 py-3.5"
              style={{ background: 'rgba(22,163,74,0.08)', border: '1px solid rgba(34,197,94,0.2)' }}>
              <span className="text-2xl flex-shrink-0">{s.icon}</span>
              <div>
                <p className="text-white text-sm font-bold">{s.title}</p>
                <p className="text-gray-500 text-xs">{s.desc}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
      {/* 하단 공유 버튼 위치 안내 화살표 */}
      <div className="flex flex-col items-center pb-8 pt-4 gap-1">
        <div className="text-3xl animate-bounce">⬇️</div>
        <p className="text-xs text-gray-600">Safari 하단 공유 버튼(□↑)</p>
      </div>
    </div>
  )

  // ── iOS but not Safari ─────────────────────────────────────────────────
  if (phase === 'ios-nosafari') return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6">
      <Header />
      <div className="w-full max-w-xs glass-card rounded-2xl p-5 text-center space-y-3">
        <p className="text-white font-semibold">Safari로 열어주세요</p>
        <p className="text-gray-400 text-sm">iOS 앱 설치는 Safari 브라우저에서만 가능합니다.</p>
        <div className="bg-gray-800 rounded-xl px-4 py-3">
          <p className="text-xs text-gray-500 mb-1">Safari에서 이 주소로 이동:</p>
          <p className="text-green-400 text-sm font-mono break-all">{appUrl}/install</p>
        </div>
      </div>
    </div>
  )

  // ── Desktop ────────────────────────────────────────────────────────────
  if (phase === 'desktop') return (
    <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6">
      <Header />
      <div className="w-full max-w-xs space-y-4 text-center">
        <p className="text-gray-400 text-sm">스마트폰으로 QR 코드를 스캔하거나<br />아래 주소로 접속하세요.</p>
        <img
          src={`https://api.qrserver.com/v1/create-qr-code/?size=180x180&bgcolor=0c160c&color=22c55e&data=${encodeURIComponent(appUrl + '/install')}`}
          alt="QR" className="w-44 h-44 mx-auto rounded-2xl"
        />
        <div className="bg-gray-800 rounded-xl px-4 py-3">
          <p className="text-green-400 text-sm font-mono break-all">{appUrl}/install</p>
        </div>
      </div>
    </div>
  )

  // 로딩
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="w-16 h-16 bg-green-700 rounded-2xl flex items-center justify-center animate-pulse">
        <span className="text-3xl">⛳</span>
      </div>
    </div>
  )
}
