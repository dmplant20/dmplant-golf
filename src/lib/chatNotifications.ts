// 채팅 알림 — 푸시 대신 앱 내 사운드 + 카운트
// (1) Web Audio API 로 작은 "핑" 소리 재생
// (2) zustand 스토어로 총 미확인 개수와 현재 활성 방 공유

import { create } from 'zustand'

interface ChatNotifyStore {
  /** 모든 방의 미확인 메시지 총합 (자기 자신이 보낸 건 제외) */
  totalUnread: number
  /** 현재 채팅 페이지에서 열려있는 방의 ID — 이 방에서 오는 메시지는 카운트·소리 모두 무시 */
  activeRoomId: string | null
  setUnread: (n: number) => void
  setActiveRoom: (id: string | null) => void
}

export const useChatNotify = create<ChatNotifyStore>((set) => ({
  totalUnread: 0,
  activeRoomId: null,
  setUnread: (n) => set({ totalUnread: Math.max(0, Math.floor(n)) }),
  setActiveRoom: (id) => set({ activeRoomId: id }),
}))

// ── 알림 소리 ────────────────────────────────────────────────────────────
// 0.25초 짧은 사인파 핑. 0.8초 안에 중복 호출되면 무시 (메시지 폭주 방어)
let lastPlayed = 0
export function playChatPing() {
  if (typeof window === 'undefined') return
  const now = Date.now()
  if (now - lastPlayed < 800) return
  lastPlayed = now
  try {
    const Ctx = (window as any).AudioContext || (window as any).webkitAudioContext
    if (!Ctx) return
    const ctx = new Ctx()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.type = 'sine'
    osc.frequency.value = 880   // A5
    gain.gain.setValueAtTime(0.18, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.25)
    osc.start()
    osc.stop(ctx.currentTime + 0.25)
    osc.onended = () => { try { ctx.close() } catch { /* ignore */ } }
  } catch { /* iOS 자동재생 정책 등은 무시 */ }
}
