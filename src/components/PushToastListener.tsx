'use client'
// SW push 가 도착하면 보내는 PUSH_RECEIVED 메시지를 받아서 인앱 토스트로 표시.
// (OS 알림은 SW 가 이미 처리. 이건 앱이 포그라운드일 때 시각적 보강 + 클릭 액션)
import { useEffect, useState } from 'react'
import { Bell, X } from 'lucide-react'
import { useRouter } from 'next/navigation'

type Toast = { id: number; title: string; body: string; url: string }

export default function PushToastListener() {
  const [toasts, setToasts] = useState<Toast[]>([])
  const router = useRouter()

  useEffect(() => {
    if (typeof window === 'undefined' || !('serviceWorker' in navigator)) return
    let idSeq = 0
    function onMsg(e: MessageEvent) {
      const d = e.data
      if (!d) return
      if (d.type === 'PUSH_RECEIVED' && d.payload) {
        const t: Toast = {
          id: ++idSeq,
          title: d.payload.title ?? '알림',
          body: d.payload.body ?? '',
          url: d.payload.url ?? '/',
        }
        setToasts(prev => [...prev.slice(-3), t])
        // 6초 후 자동 사라짐
        setTimeout(() => setToasts(p => p.filter(x => x.id !== t.id)), 6000)
      }
    }
    navigator.serviceWorker.addEventListener('message', onMsg)
    return () => navigator.serviceWorker.removeEventListener('message', onMsg)
  }, [])

  if (toasts.length === 0) return null

  return (
    <div className="fixed top-3 left-3 right-3 z-[400] space-y-2 pointer-events-none">
      {toasts.map(t => (
        <button
          key={t.id}
          type="button"
          onClick={() => {
            try { router.push(t.url) } catch { window.location.href = t.url }
            setToasts(p => p.filter(x => x.id !== t.id))
          }}
          className="pointer-events-auto w-full flex items-start gap-3 rounded-xl px-3.5 py-3 text-left shadow-2xl animate-slide-down active:scale-[0.98] transition"
          style={{
            background: 'linear-gradient(135deg, rgba(15,23,42,0.96), rgba(30,41,59,0.96))',
            border: '1px solid rgba(201,168,76,0.5)',
            backdropFilter: 'blur(12px)',
            boxShadow: '0 10px 40px rgba(0,0,0,0.5)',
          }}
        >
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
            style={{ background: 'rgba(201,168,76,0.18)' }}>
            <Bell size={14} style={{ color: '#c9a84c' }} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold leading-tight" style={{ color: '#fff' }}>{t.title}</p>
            {t.body && <p className="text-xs mt-0.5 leading-snug" style={{ color: 'rgba(255,255,255,0.75)' }}>{t.body}</p>}
          </div>
          <span
            onClick={(e) => { e.stopPropagation(); setToasts(p => p.filter(x => x.id !== t.id)) }}
            className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(255,255,255,0.08)', color: 'rgba(255,255,255,0.6)' }}>
            <X size={12} />
          </span>
        </button>
      ))}
      <style jsx>{`
        @keyframes slide-down { from { transform: translateY(-20px); opacity: 0 } to { transform: translateY(0); opacity: 1 } }
        :global(.animate-slide-down) { animation: slide-down 0.25s ease-out }
      `}</style>
    </div>
  )
}
