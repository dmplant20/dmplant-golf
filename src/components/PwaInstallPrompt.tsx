'use client'
// ── PWA 설치 배너 ──────────────────────────────────────────────────────────
// layout.tsx 인라인 스크립트가 beforeinstallprompt를 window.__pwaPrompt에
// 이미 캡처해 두므로 여기서는 그걸 읽기만 합니다.
// iOS Safari는 별도 안내 배너를 표시합니다.
import { useEffect, useState } from 'react'
import { Download, X, Share } from 'lucide-react'

export default function PwaInstallPrompt() {
  const [show,        setShow]        = useState(false)
  const [isIOS,       setIsIOS]       = useState(false)
  const [done,        setDone]        = useState(false)
  const [androidManual,setAndroidManual] = useState(false)  // beforeinstallprompt 미발생 → 수동 안내

  useEffect(() => {
    // ── 진짜 standalone 여부 (display-mode 기준만 신뢰) ─────────────────
    const realStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true

    // 사용자가 PWA를 삭제하면 standalone false가 되지만 localStorage는 남음 → 자동 클리어
    if (!realStandalone && localStorage.getItem('pwa-installed') === '1') {
      localStorage.removeItem('pwa-installed')
    }
    if (realStandalone) return  // 진짜 PWA로 실행 중이면 배너 안 뜸

    const ua = navigator.userAgent

    // ── iOS Safari 전용 안내 ──────────────────────────────────────────────
    const ios    = /iPhone|iPad|iPod/i.test(ua) && !(window as any).MSStream
    const safari = /Safari/i.test(ua) && !/CriOS|FxiOS|EdgiOS|OPiOS/i.test(ua)
    if (ios && safari) {
      if (!sessionStorage.getItem('pwa-ios-dismissed')) {
        setIsIOS(true)
        setTimeout(() => setShow(true), 1500)
      }
      return
    }

    // ── Android: window.__pwaPrompt 확인 (layout 스크립트가 이미 캡처) ──────
    if (sessionStorage.getItem('pwa-install-dismissed')) return

    // 이미 캡처된 prompt가 있으면 바로 배너 표시
    if ((window as any).__pwaPrompt) {
      setShow(true)
      return
    }

    // 아직 이벤트가 오지 않았으면 커스텀 이벤트 대기
    function onInstallable() { setShow(true); setAndroidManual(false) }
    function onInstalled()   { setShow(false); setDone(true) }

    window.addEventListener('pwa:installable', onInstallable)
    window.addEventListener('pwa:installed',   onInstalled)

    // Chrome이 beforeinstallprompt를 안 보내는 경우(설치-삭제 후 90일 억제 등)
    // 5초 후에도 prompt가 없으면 수동 안내 배너로 fallback
    const fallbackTimer = setTimeout(() => {
      if (!(window as any).__pwaPrompt && /Android|Chrome|SamsungBrowser/i.test(ua)) {
        setAndroidManual(true)
        setShow(true)
      }
    }, 5000)

    return () => {
      clearTimeout(fallbackTimer)
      window.removeEventListener('pwa:installable', onInstallable)
      window.removeEventListener('pwa:installed',   onInstalled)
    }
  }, [])

  async function handleInstall() {
    const p = (window as any).__pwaPrompt
    if (!p) return
    p.prompt()
    const { outcome } = await p.userChoice
    ;(window as any).__pwaPrompt = null
    setShow(false)
    if (outcome === 'accepted') setDone(true)
  }

  function dismiss(key: string) {
    sessionStorage.setItem(key, '1')
    setShow(false)
  }

  if (!show || done) return null

  // ── iOS 안내 배너 ─────────────────────────────────────────────────────
  if (isIOS) {
    return (
      <div className="fixed bottom-24 left-4 right-4 z-[9999] animate-slide-up">
        <div className="bg-gray-900 rounded-2xl p-4 shadow-2xl"
          style={{ border: '1px solid rgba(34,197,94,0.35)', boxShadow: '0 8px 40px rgba(0,0,0,0.7)' }}>
          <div className="flex items-start justify-between mb-3">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 bg-green-700 rounded-xl flex items-center justify-center">
                <span className="text-lg">⛳</span>
              </div>
              <div>
                <p className="text-white font-bold text-sm">홈 화면에 앱 추가</p>
                <p className="text-xs" style={{ color: '#9aae9a' }}>오프라인에서도 빠르게 사용</p>
              </div>
            </div>
            <button onClick={() => dismiss('pwa-ios-dismissed')}
              className="text-gray-400 hover:text-gray-300 p-1 -mr-1">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2 text-xs text-gray-300">
            <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <Share size={14} style={{ color: '#3b82f6' }} className="flex-shrink-0" />
              <span>하단 <strong className="text-white">공유 버튼(□↑)</strong>을 탭하세요</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-base flex-shrink-0">➕</span>
              <span><strong className="text-white">홈 화면에 추가</strong>를 선택하세요</span>
            </div>
          </div>
          <p className="text-center text-xs mt-3" style={{ color: '#7a9a7a' }}>
            또는{' '}
            <a href="/install" className="text-green-500 underline underline-offset-2">
              설치 안내 페이지
            </a>
            에서 자세히 보기
          </p>
        </div>
        {/* 말풍선 꼬리 */}
        <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 w-4 h-4 bg-gray-900 rotate-45"
          style={{ border: '1px solid rgba(34,197,94,0.35)', clipPath: 'polygon(0 50%, 50% 100%, 100% 50%)' }} />
      </div>
    )
  }

  // ── Android 수동 안내 배너 (beforeinstallprompt 미발생 시) ─────────────
  if (androidManual) {
    return (
      <div className="fixed bottom-24 left-4 right-4 z-[9999] animate-slide-up">
        <div className="rounded-2xl p-4"
          style={{
            background: 'linear-gradient(135deg,rgba(201,168,76,0.15),rgba(12,22,12,0.97))',
            border: '1px solid rgba(201,168,76,0.4)',
            boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,168,76,0.08)',
          }}>
          <div className="flex items-center gap-3 mb-3">
            <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
              style={{ background: 'linear-gradient(135deg,#c9a84c,#6b4c1a)', boxShadow: '0 4px 16px rgba(201,168,76,0.35)' }}>
              <span className="text-2xl">⛳</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-white font-bold text-sm">홈 화면에 앱 추가</p>
              <p className="text-xs" style={{ color: '#a3956a' }}>Chrome 메뉴에서 설치할 수 있습니다</p>
            </div>
            <button onClick={() => dismiss('pwa-install-dismissed')}
              className="text-gray-400 hover:text-gray-300 p-1 -mr-1 flex-shrink-0">
              <X size={16} />
            </button>
          </div>
          <div className="space-y-2 text-xs text-gray-300">
            <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-base flex-shrink-0">⋮</span>
              <span>Chrome 우상단 <strong className="text-white">⋮ (점 3개)</strong> 메뉴 탭</span>
            </div>
            <div className="flex items-center gap-2.5 rounded-xl px-3 py-2.5"
              style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.06)' }}>
              <span className="text-base flex-shrink-0">📲</span>
              <span><strong className="text-white">"앱 설치"</strong> 또는 <strong className="text-white">"홈 화면에 추가"</strong> 선택</span>
            </div>
          </div>
          <p className="text-center text-xs mt-3" style={{ color: '#a3956a' }}>
            자세한 안내는{' '}
            <a href="/install" className="underline underline-offset-2" style={{ color: '#e8c96d' }}>
              설치 안내 페이지
            </a>
          </p>
        </div>
      </div>
    )
  }

  // ── Android 자동 설치 배너 (beforeinstallprompt 발생 시) ───────────────
  return (
    <div className="fixed bottom-24 left-4 right-4 z-[9999] animate-slide-up">
      <div className="rounded-2xl p-4"
        style={{
          background: 'linear-gradient(135deg,rgba(201,168,76,0.15),rgba(12,22,12,0.97))',
          border: '1px solid rgba(201,168,76,0.4)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(201,168,76,0.08)',
        }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg"
            style={{ background: 'linear-gradient(135deg,#c9a84c,#6b4c1a)', boxShadow: '0 4px 16px rgba(201,168,76,0.35)' }}>
            <span className="text-2xl">⛳</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm">Inter Stellar GOLF</p>
            <p className="text-xs" style={{ color: '#a3956a' }}>홈 화면에 앱 아이콘을 설치하세요</p>
          </div>
          <button onClick={() => dismiss('pwa-install-dismissed')}
            className="text-gray-400 hover:text-gray-300 p-1 -mr-1 flex-shrink-0">
            <X size={16} />
          </button>
        </div>
        <button onClick={handleInstall}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg,#c9a84c,#a07830)', boxShadow: '0 4px 16px rgba(201,168,76,0.35)' }}>
          <Download size={15} />
          지금 설치 (홈 화면에 추가)
        </button>
      </div>
    </div>
  )
}
