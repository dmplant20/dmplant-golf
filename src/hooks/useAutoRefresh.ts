import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'

interface Options {
  /** 포그라운드 복귀 시 자동 재로드 (기본 true) */
  onVisible?: boolean
  /** Realtime 구독할 테이블 + 필터 */
  realtime?: {
    table: string
    filter?: string
  }
  /** 폴링 간격 ms (기본 120000 = 2분). 0이면 폴링 비활성화 */
  pollInterval?: number
  /** 폴링 시 로딩 UI 없이 조용히 갱신할 함수 (없으면 load 사용) */
  silentLoad?: () => void
}

/**
 * 페이지 자동 갱신 훅
 * - 앱 포그라운드 복귀 시 load() 호출
 * - Supabase Realtime 구독으로 DB 변경 시 load() 호출
 * - 주기적 폴링으로 변경 누락 보완 (기본 15초)
 * - currentClubId 변경 시 재구독
 */
export function useAutoRefresh(
  load: () => void,
  currentClubId: string | null,
  options: Options = {}
) {
  const { onVisible = true, realtime, pollInterval = 120000, silentLoad } = options
  const loadRef = useRef(load)
  const silentRef = useRef(silentLoad)
  useEffect(() => { loadRef.current = load; silentRef.current = silentLoad })

  // 포그라운드 복귀 시 갱신
  useEffect(() => {
    if (!onVisible) return
    function handleVisible() {
      if (document.visibilityState === 'visible') loadRef.current()
    }
    document.addEventListener('visibilitychange', handleVisible)
    return () => document.removeEventListener('visibilitychange', handleVisible)
  }, [currentClubId])

  // Realtime 구독
  useEffect(() => {
    if (!realtime || !currentClubId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`auto-${realtime.table}-${currentClubId}`)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: realtime.table,
        ...(realtime.filter ? { filter: realtime.filter } : {}),
      }, () => loadRef.current())
      .subscribe()
    return () => { supabase.removeChannel(channel) }
  }, [currentClubId])

  // 폴링: 포그라운드 상태일 때만 주기적으로 조용히 갱신
  useEffect(() => {
    if (!pollInterval || !currentClubId) return
    const id = setInterval(() => {
      if (document.visibilityState === 'visible') {
        // silentLoad가 있으면 스피너 없이, 없으면 일반 load
        const fn = silentRef.current ?? loadRef.current
        fn()
      }
    }, pollInterval)
    return () => clearInterval(id)
  }, [currentClubId, pollInterval])
}
