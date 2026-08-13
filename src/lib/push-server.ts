// 서버 사이드 푸시 발송 공통 헬퍼
// - VAPID 초기화 (1회)
// - 사용자별 알림 설정 체크 (user_notification_preferences)
// - 사용자별 구독(endpoint) 조회 → webpush.sendNotification
// - 성공/실패/스킵 모두 notification_logs 에 INSERT
// - 410/404 만료 endpoint 자동 정리
import webpush from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'
import { sendNativePush } from './push-native-server'

let vapidReady = false
export function initVapid(): boolean {
  if (vapidReady) return true
  const pub  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const priv = process.env.VAPID_PRIVATE_KEY
  const mail = process.env.VAPID_EMAIL ?? 'mailto:admin@example.com'
  if (!pub || !priv) return false
  webpush.setVapidDetails(mail, pub, priv)
  vapidReady = true
  return true
}

export type NotificationType =
  | 'announcement'
  | 'meeting'
  | 'finance'
  | 'birthday'
  | 'chat'
  | 'admin_test'
  | 'admin_other'

export interface SendArgs {
  service:    SupabaseClient
  userIds:    string[]
  type:       NotificationType
  title:      string
  body?:      string
  url?:       string
  clubId?:    string | null
  sentBy?:    string | null
  // 사용자 설정 무시 — 관리자 테스트에서 사용 (단, 본인이 admin_test 거부했으면 그건 존중)
  skipPreferenceCheck?: boolean
}

export interface SendResultDetail {
  user_id:       string
  status:        'success' | 'failed' | 'skipped'
  error_code?:   string
  error_message?: string
  status_code?:  number
  endpoint_hint?: string
}

export interface SendResult {
  sent:        number
  failed:      number
  skipped:     number
  total:       number
  details:     SendResultDetail[]
  logIds:      string[]
}

// preference 카테고리 매핑 (notification_type → user_notification_preferences 컬럼명)
const TYPE_TO_PREF: Record<NotificationType, string> = {
  announcement: 'announcements',
  meeting:      'meetings',
  finance:      'finance',
  birthday:     'birthday',
  chat:         'chat',
  admin_test:   'admin_test',
  admin_other:  'all_enabled',  // 기타 관리자 발송은 마스터 스위치만 검사
}

/**
 * 핵심 — 다대다 발송 + 로깅 + endpoint 만료 정리
 *
 * 동작:
 *  1. VAPID 키 미설정 → 모두 'skipped' (server_key_error) 로그
 *  2. 사용자별로:
 *     a. 알림 설정 조회 (없으면 기본 true)
 *     b. 마스터 스위치 OR 카테고리 OFF → 'skipped' (preference_off)
 *     c. push_subscriptions 조회 (없으면 'skipped' (no_token))
 *     d. 각 endpoint 마다 webpush.sendNotification → 성공/실패 로깅
 *  3. 410/404 endpoint 일괄 삭제
 *  4. notification_logs 일괄 INSERT
 */
export async function sendPushWithLogging(args: SendArgs): Promise<SendResult> {
  const { service, userIds, type, title, body, url, clubId, sentBy, skipPreferenceCheck } = args

  const result: SendResult = { sent: 0, failed: 0, skipped: 0, total: 0, details: [], logIds: [] }
  const logRows: any[] = []
  const expiredEndpoints: string[] = []
  const payload = JSON.stringify({ title, body: body ?? '', url: url ?? '/' })

  // 1. VAPID 미설정 — 모두 skipped 처리하고 로깅
  if (!initVapid()) {
    for (const uid of userIds) {
      const det: SendResultDetail = {
        user_id: uid, status: 'skipped',
        error_code: 'server_key_error',
        error_message: 'VAPID keys not configured on server',
      }
      result.details.push(det); result.skipped++
      logRows.push({
        user_id: uid, club_id: clubId ?? null, type, title, body: body ?? null, url: url ?? null,
        status: 'skipped', error_code: 'server_key_error', error_message: det.error_message,
        sent_by: sentBy ?? null,
      })
    }
    result.total = userIds.length
    if (logRows.length) await service.from('notification_logs').insert(logRows)
    return result
  }

  // 2. 사용자 설정 일괄 조회
  let prefMap: Map<string, any> = new Map()
  if (!skipPreferenceCheck && userIds.length > 0) {
    const { data: prefs } = await service.from('user_notification_preferences')
      .select('*').in('user_id', userIds)
    if (prefs) for (const p of prefs) prefMap.set(p.user_id, p)
  }

  // 3. 구독 일괄 조회
  const { data: allSubs } = await service.from('push_subscriptions')
    .select('user_id, endpoint, p256dh, auth')
    .in('user_id', userIds)
  const subsByUser = new Map<string, any[]>()
  for (const s of (allSubs ?? [])) {
    const arr = subsByUser.get(s.user_id) ?? []
    arr.push(s); subsByUser.set(s.user_id, arr)
  }

  // 4. 사용자별 발송
  const prefCol = TYPE_TO_PREF[type]
  for (const uid of userIds) {
    // 설정 체크
    if (!skipPreferenceCheck) {
      const p = prefMap.get(uid)
      if (p) {
        const masterOff = !p.all_enabled
        const catOff    = prefCol !== 'all_enabled' && p[prefCol] === false
        if (masterOff || catOff) {
          const reason = masterOff ? '전체 알림 OFF' : `${prefCol} 카테고리 OFF`
          result.details.push({ user_id: uid, status: 'skipped', error_code: 'preference_off', error_message: reason })
          result.skipped++
          logRows.push({
            user_id: uid, club_id: clubId ?? null, type, title, body: body ?? null, url: url ?? null,
            status: 'skipped', error_code: 'preference_off', error_message: reason, sent_by: sentBy ?? null,
          })
          continue
        }
      }
    }

    const userSubs = subsByUser.get(uid) ?? []
    if (userSubs.length === 0) {
      result.details.push({ user_id: uid, status: 'skipped', error_code: 'no_token', error_message: '푸시 구독 없음 (회원이 알림 활성화 안 함)' })
      result.skipped++
      logRows.push({
        user_id: uid, club_id: clubId ?? null, type, title, body: body ?? null, url: url ?? null,
        status: 'skipped', error_code: 'no_token',
        error_message: '푸시 구독 없음 (회원이 알림 활성화 안 함)',
        sent_by: sentBy ?? null,
      })
      continue
    }

    // 회원의 모든 endpoint 에 발송 (여러 기기 가능)
    let anySuccess = false
    for (const sub of userSubs) {
      const epHint = String(sub.endpoint).slice(0, 60)
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 86400 }
        )
        anySuccess = true
        result.details.push({ user_id: uid, status: 'success', endpoint_hint: epHint, status_code: 201 })
        logRows.push({
          user_id: uid, club_id: clubId ?? null, type, title, body: body ?? null, url: url ?? null,
          status: 'success', endpoint_hint: epHint, status_code: 201, sent_by: sentBy ?? null,
        })
      } catch (err: any) {
        const code = err.statusCode
        let errorCode = 'api_error'
        if (code === 410 || code === 404) { errorCode = 'token_expired'; expiredEndpoints.push(sub.endpoint) }
        else if (code === 401 || code === 403) errorCode = 'server_key_error'
        else if (code === 429) errorCode = 'rate_limited'
        const msg = err.message ?? String(err)
        result.details.push({ user_id: uid, status: 'failed', error_code: errorCode, error_message: msg, status_code: code, endpoint_hint: epHint })
        logRows.push({
          user_id: uid, club_id: clubId ?? null, type, title, body: body ?? null, url: url ?? null,
          status: 'failed', error_code: errorCode, error_message: msg.slice(0, 500),
          endpoint_hint: epHint, status_code: code ?? null, sent_by: sentBy ?? null,
        })
      }
    }
    if (anySuccess) result.sent++; else result.failed++
  }

  // 4b. 네이티브 푸시(FCM/APNs) 동시 발송 — device_push_tokens.
  //     env 미설정이면 내부에서 조용히 스킵. logRows 에 결과를 append.
  //     (채널 배타로 같은 기기 중복 없음. notification_logs 가 발송 진실의 원천)
  try {
    await sendNativePush({
      service, userIds, type, title, body, url, clubId, sentBy,
      prefMap, prefCol, skipPreferenceCheck, logRows,
    })
  } catch (e) {
    console.warn('[push] native send failed', e)
  }

  result.total = userIds.length

  // 5. 만료 endpoint 정리 + 로그 저장
  if (expiredEndpoints.length) {
    await service.from('push_subscriptions').delete().in('endpoint', expiredEndpoints)
  }
  if (logRows.length) {
    const { data: ins } = await service.from('notification_logs').insert(logRows).select('id')
    if (ins) result.logIds = ins.map((r: any) => r.id)
  }

  return result
}
