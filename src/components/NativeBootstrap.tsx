'use client'
import { useEffect } from 'react'
import { isNativeApp } from '@/lib/native'
import { initNativeAuthListener } from '@/lib/auth/nativeOAuth'

// 네이티브(Capacitor) 앱 부팅 초기화 — 루트 레이아웃에 전역 마운트.
// 웹 브라우저에선 isNativeApp()===false 라 아무 것도 하지 않는다(no-op).
//  · OAuth 딥링크 복귀 리스너 등록
//  · (Phase 2) 네이티브 푸시 등록은 로그인 이후 별도 트리거
export default function NativeBootstrap() {
  useEffect(() => {
    if (!isNativeApp()) return
    initNativeAuthListener().catch((e) => console.warn('[native] auth listener init', e))
    // 상태바 스타일(선택) — 실패해도 무시
    ;(async () => {
      try {
        const { StatusBar, Style } = await import('@capacitor/status-bar')
        await StatusBar.setStyle({ style: Style.Dark })
      } catch { /* status-bar 미지원 플랫폼 무시 */ }
    })()
  }, [])
  return null
}
