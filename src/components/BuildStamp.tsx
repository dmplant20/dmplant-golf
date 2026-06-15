'use client'
// 빌드 버전 표시 — 회원이 새 코드 도달 여부를 한눈에 확인
// /api/version 응답을 비교해서 회면 하단 모서리에 작은 텍스트로 노출
import { useEffect, useState } from 'react'

export default function BuildStamp() {
  const [v, setV] = useState<string>('')
  useEffect(() => {
    fetch('/api/version', { cache: 'no-store' })
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.version) setV(String(d.version).slice(0, 8)) })
      .catch(() => {})
  }, [])
  if (!v) return null
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 'calc(env(safe-area-inset-bottom) + 4px)',
        right: 6,
        zIndex: 1,
        fontSize: 9,
        fontFamily: 'monospace',
        color: 'rgba(201,168,76,0.55)',
        background: 'rgba(0,0,0,0.4)',
        padding: '1px 5px',
        borderRadius: 4,
        pointerEvents: 'none',
        letterSpacing: '0.5px',
      }}
      aria-hidden="true"
    >
      v:{v}
    </div>
  )
}
