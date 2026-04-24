'use client'
import { useEffect, useState } from 'react'
import { Download, Share, Check, Smartphone, Monitor, ExternalLink } from 'lucide-react'

// ── 설치 안내 페이지 (/install) ───────────────────────────────────────────
// • 인증 불필요 (공개 페이지)
// • 디바이스 자동 감지 (Android / iOS / Desktop)
// • Android: beforeinstallprompt 자동 트리거
// • iOS: Safari 단계별 안내
// • Desktop: 주소 공유 안내
export default function InstallPage() {
  const [device,    setDevice]    = useState<'android' | 'ios' | 'desktop' | null>(null)
  const [prompt,    setPrompt]    = useState<any>(null)
  const [installed, setInstalled] = useState(false)
  const [installing,setInstalling]= useState(false)
  const [isChrome,  setIsChrome]  = useState(true)
  const [appUrl,    setAppUrl]    = useState('')

  useEffect(() => {
    const ua = navigator.userAgent
    const standalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (navigator as any).standalone === true

    if (standalone) { setInstalled(true); return }

    // 디바이스 감지
    const isIOS     = /iPhone|iPad|iPod/i.test(ua) && !(window as any).MSStream
    const isAndroid = /Android/i.test(ua)
    setDevice(isIOS ? 'ios' : isAndroid ? 'android' : 'desktop')

    // Chrome 여부 (iOS에서는 Safari 필요)
    const isSafariBrowser = /Safari/i.test(ua) && !/Chrome|CriOS/i.test(ua)
    if (isIOS) setIsChrome(isSafariBrowser)

    setAppUrl(window.location.origin)

    // Android: beforeinstallprompt 대기
    if (isAndroid) {
      const handler = (e: any) => {
        e.preventDefault()
        setPrompt(e)
      }
      window.addEventListener('beforeinstallprompt', handler)
      window.addEventListener('appinstalled', () => setInstalled(true))
      return () => window.removeEventListener('beforeinstallprompt', handler)
    }
  }, [])

  async function handleInstall() {
    if (!prompt) return
    setInstalling(true)
    prompt.prompt()
    const { outcome } = await prompt.userChoice
    setInstalling(false)
    if (outcome === 'accepted') setInstalled(true)
  }

  // ── 이미 설치됨 ──────────────────────────────────────────────────────────
  if (installed) {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-20 h-20 bg-green-700 rounded-3xl flex items-center justify-center mb-6 shadow-xl shadow-green-900/50">
          <Check size={40} className="text-white" />
        </div>
        <h1 className="text-2xl font-extrabold text-white mb-2">설치 완료!</h1>
        <p className="text-gray-400 text-sm mb-8">홈 화면에서 Inter Stellar GOLF를 실행하세요.</p>
        <a href="/login"
          className="bg-green-600 hover:bg-green-500 text-white font-bold px-8 py-3.5 rounded-2xl text-sm transition">
          앱 시작하기 →
        </a>
      </div>
    )
  }

  const logo = (
    <div className="w-20 h-20 bg-gradient-to-br from-green-600 to-green-800 rounded-3xl flex items-center justify-center mb-5 shadow-xl shadow-green-900/50 mx-auto">
      <span className="text-4xl">⛳</span>
    </div>
  )

  const title = (
    <div className="text-center mb-6">
      {logo}
      <h1 className="text-2xl font-extrabold text-white">Inter Stellar GOLF</h1>
      <p className="text-sm text-gray-500 mt-1">골프 모임 관리 앱</p>
    </div>
  )

  // ── Android ──────────────────────────────────────────────────────────────
  if (device === 'android') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-5 py-10">
        {title}

        {prompt ? (
          /* beforeinstallprompt 준비됨 — 바로 설치 가능 */
          <div className="w-full max-w-sm space-y-4">
            <div className="glass-card rounded-2xl p-5 text-center space-y-3">
              <Smartphone size={28} className="text-green-400 mx-auto" />
              <p className="text-white font-semibold">홈 화면에 앱 추가</p>
              <p className="text-gray-400 text-sm">한 번의 탭으로 앱이 홈 화면에 설치됩니다.</p>
              <button onClick={handleInstall} disabled={installing}
                className="w-full bg-green-600 hover:bg-green-500 active:bg-green-700 disabled:opacity-50 text-white font-bold py-4 rounded-2xl text-base transition flex items-center justify-center gap-2"
                style={{ boxShadow: '0 4px 20px rgba(22,163,74,0.4)' }}>
                <Download size={18} />
                {installing ? '설치 중...' : '지금 설치하기'}
              </button>
            </div>
            <p className="text-center text-xs text-gray-600">
              설치 버튼이 보이지 않으면 주소창에서 직접 "홈 화면에 추가"를 선택하세요.
            </p>
          </div>
        ) : (
          /* Chrome에서 열기 유도 */
          <div className="w-full max-w-sm space-y-4">
            <div className="glass-card rounded-2xl p-5 space-y-4">
              <p className="text-white font-semibold text-center">Chrome에서 설치하세요</p>
              <Steps steps={[
                { n: 1, text: 'Chrome 브라우저를 열어주세요' },
                { n: 2, text: <>주소창에 입력: <code className="bg-gray-800 px-2 py-0.5 rounded text-green-400 text-xs">{appUrl}/install</code></> },
                { n: 3, text: '"설치" 또는 "홈 화면에 추가" 버튼을 탭하세요' },
              ]} />
            </div>
            <a href={`${appUrl}/install`}
              className="flex items-center justify-center gap-2 w-full bg-green-600 text-white font-bold py-4 rounded-2xl text-sm"
              style={{ boxShadow: '0 4px 20px rgba(22,163,74,0.4)' }}>
              <ExternalLink size={16} />
              Chrome으로 열기
            </a>
          </div>
        )}
      </div>
    )
  }

  // ── iOS ──────────────────────────────────────────────────────────────────
  if (device === 'ios') {
    if (!isChrome) {
      /* Chrome/CriOS 등 — Safari에서 열도록 안내 */
      return (
        <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-5 py-10">
          {title}
          <div className="w-full max-w-sm glass-card rounded-2xl p-5 space-y-4 text-center">
            <p className="text-white font-semibold">Safari에서 열어주세요</p>
            <p className="text-gray-400 text-sm">iOS에서는 Safari 브라우저로만 홈 화면 설치가 가능합니다.</p>
            <div className="bg-gray-800 rounded-xl px-4 py-3">
              <p className="text-xs text-gray-400">주소를 복사해서 Safari에 붙여넣기</p>
              <p className="text-green-400 text-sm font-mono mt-1">{appUrl}/install</p>
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-5 py-10 pb-24">
        {title}
        <div className="w-full max-w-sm space-y-4">
          <div className="glass-card rounded-2xl p-5 space-y-4">
            <p className="text-white font-semibold text-center">📱 홈 화면에 추가하기</p>
            <Steps steps={[
              { n: 1, text: <><strong className="text-white">하단 공유 버튼(□↑)</strong>을 탭하세요</> },
              { n: 2, text: <>스크롤 후 <strong className="text-white">"홈 화면에 추가"</strong>를 탭하세요</> },
              { n: 3, text: <>오른쪽 위 <strong className="text-white">"추가"</strong>를 탭하세요</> },
            ]} />
          </div>

          {/* 하단 화살표 애니메이션 — 공유 버튼 위치 안내 */}
          <div className="flex flex-col items-center gap-2 py-4">
            <div className="w-10 h-10 rounded-full bg-blue-600/20 border border-blue-500/40 flex items-center justify-center animate-bounce">
              <Share size={18} className="text-blue-400" />
            </div>
            <p className="text-xs text-gray-500">Safari 화면 하단 중앙의 공유 버튼</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Desktop ───────────────────────────────────────────────────────────────
  if (device === 'desktop') {
    return (
      <div className="min-h-screen bg-gray-950 flex flex-col items-center justify-center px-5 py-10">
        {title}
        <div className="w-full max-w-sm glass-card rounded-2xl p-5 space-y-4 text-center">
          <Monitor size={28} className="text-green-400 mx-auto" />
          <p className="text-white font-semibold">모바일로 설치하세요</p>
          <p className="text-gray-400 text-sm">스마트폰에서 아래 주소로 접속하거나 QR 코드를 스캔하세요.</p>
          <div className="bg-gray-800 rounded-xl p-3">
            <p className="text-green-400 text-sm font-mono break-all">{appUrl}/install</p>
          </div>
          {/* QR 코드 (api.qrserver.com 무료 서비스) */}
          <img
            src={`https://api.qrserver.com/v1/create-qr-code/?size=160x160&bgcolor=0c160c&color=22c55e&data=${encodeURIComponent(appUrl + '/install')}`}
            alt="QR 코드"
            className="w-40 h-40 mx-auto rounded-xl"
          />
          <p className="text-xs text-gray-500">QR 코드를 스캔하면 모바일 설치 화면으로 이동합니다</p>
        </div>
      </div>
    )
  }

  // 로딩 중
  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center">
      <div className="text-center space-y-3">
        <div className="w-16 h-16 bg-green-700 rounded-2xl flex items-center justify-center mx-auto">
          <span className="text-3xl">⛳</span>
        </div>
        <p className="text-gray-500 text-sm">로딩 중...</p>
      </div>
    </div>
  )
}

// ── Steps 헬퍼 컴포넌트 ────────────────────────────────────────────────────
function Steps({ steps }: { steps: { n: number; text: React.ReactNode }[] }) {
  return (
    <div className="space-y-3">
      {steps.map(({ n, text }) => (
        <div key={n} className="flex items-start gap-3">
          <div className="w-7 h-7 rounded-full bg-green-700 flex items-center justify-center flex-shrink-0 text-white text-sm font-bold">
            {n}
          </div>
          <p className="text-sm text-gray-300 leading-relaxed pt-0.5">{text}</p>
        </div>
      ))}
    </div>
  )
}
