'use client'
// ── PWA 설치 배너 ──────────────────────────────────────────────────────────
// layout.tsx 인라인 스크립트가 beforeinstallprompt를 window.__pwaPrompt에
// 이미 캡처해 두므로 여기서는 그걸 읽기만 합니다.
// iOS Safari는 별도 안내 배너를 표시합니다.
import { useEffect, useState } from 'react'
import { Download, X, Share } from 'lucide-react'

export default function PwaInstallPrompt() {
  const [show,  setShow]  = useState(false)
  const [isIOS, setIsIOS] = useState(false)
  const [done,  setDone]  = useState(false)

  useEffect(() => {
    // 이미 PWA 모드로 실행 중이면 표시 안 함
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true ||
      localStorage.getItem('pwa-installed') === '1'
    if (standalone) return

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
    function onInstallable() { setShow(true) }
    function onInstalled()   { setShow(false); setDone(true) }

    window.addEventListener('pwa:installable', onInstallable)
    window.addEventListener('pwa:installed',   onInstalled)
    return () => {
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
                <p className="text-xs" style={{ color: '#5a7a5a' }}>오프라인에서도 빠르게 사용</p>
              </div>
            </div>
            <button onClick={() => dismiss('pwa-ios-dismissed')}
              className="text-gray-500 hover:text-gray-300 p-1 -mr-1">
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
          <p className="text-center text-xs mt-3" style={{ color: '#3a5a3a' }}>
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

  // ── Android 설치 배너 ─────────────────────────────────────────────────
  return (
    <div className="fixed bottom-24 left-4 right-4 z-[9999] animate-slide-up">
      <div className="rounded-2xl p-4"
        style={{
          background: 'linear-gradient(135deg,rgba(22,163,74,0.15),rgba(12,22,12,0.97))',
          border: '1px solid rgba(34,197,94,0.4)',
          boxShadow: '0 8px 40px rgba(0,0,0,0.7), 0 0 0 1px rgba(34,197,94,0.08)',
        }}>
        <div className="flex items-center gap-3 mb-3">
          <div className="w-11 h-11 bg-green-700 rounded-2xl flex items-center justify-center flex-shrink-0 shadow-lg shadow-green-900/50">
            <span className="text-2xl">⛳</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white font-bold text-sm">Inter Stellar GOLF</p>
            <p className="text-xs" style={{ color: '#5a7a5a' }}>홈 화면에 앱 아이콘을 설치하세요</p>
          </div>
          <button onClick={() => dismiss('pwa-install-dismissed')}
            className="text-gray-500 hover:text-gray-300 p-1 -mr-1 flex-shrink-0">
            <X size={16} />
          </button>
        </div>
        <button onClick={handleInstall}
          className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-bold text-white transition active:scale-[0.98]"
          style={{ background: 'linear-gradient(135deg,#16a34a,#15803d)', boxShadow: '0 4px 16px rgba(22,163,74,0.35)' }}>
          <Download size={15} />
          지금 설치 (홈 화면에 추가)
        </button>
      </div>
    </div>
  )
}
