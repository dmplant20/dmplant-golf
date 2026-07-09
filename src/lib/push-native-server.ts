// 서버 사이드 네이티브 푸시 발송 — FCM(Android) + APNs(iOS).
//
// sendPushWithLogging(push-server.ts) 내부에서 호출되어, 웹푸시와 "동시에"
// device_push_tokens 로도 발송한다. 호출부(7곳) 수정 0.
//
// env 미설정 시(FCM/APNs 키 없음) 조용히 스킵 → Firebase/APNs 준비 전에
// 배포해도 안전(웹푸시는 그대로 동작).
//
// 채널 배타(중복 방지): 네이티브 기기는 native 토큰만, 브라우저는 웹푸시만
// 등록하므로(push-native.ts / push.ts) 같은 기기에서 중복 알림은 발생하지 않음.
import http2 from 'node:http2'
import jwt from 'jsonwebtoken'
import { GoogleAuth } from 'google-auth-library'
import type { SupabaseClient } from '@supabase/supabase-js'

// ── FCM (Android) ────────────────────────────────────────────────────────────
let _fcmToken: { token: string; exp: number } | null = null

async function getFcmAccessToken(): Promise<string | null> {
  const raw = process.env.FCM_SERVICE_ACCOUNT
  if (!raw) return null
  const now = Date.now()
  if (_fcmToken && _fcmToken.exp > now + 60_000) return _fcmToken.token
  try {
    const credentials = JSON.parse(raw)
    const auth = new GoogleAuth({ credentials, scopes: ['https://www.googleapis.com/auth/firebase.messaging'] })
    const token = await auth.getAccessToken()
    if (!token) return null
    _fcmToken = { token, exp: now + 55 * 60 * 1000 }
    return token
  } catch (e) {
    console.warn('[push-native] FCM auth failed', e)
    return null
  }
}

async function sendFcm(
  projectId: string, accessToken: string, token: string,
  title: string, body: string, url: string,
): Promise<{ ok: boolean; dead: boolean; error?: string }> {
  try {
    const res = await fetch(`https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message: {
          token,
          notification: { title, body },
          data: { url },
          android: { priority: 'HIGH' },
        },
      }),
    })
    if (res.ok) return { ok: true, dead: false }
    const errText = await res.text().catch(() => '')
    const dead = res.status === 404 || /UNREGISTERED|NOT_FOUND|InvalidRegistration/i.test(errText)
    return { ok: false, dead, error: `${res.status} ${errText.slice(0, 180)}` }
  } catch (e) {
    return { ok: false, dead: false, error: e instanceof Error ? e.message : String(e) }
  }
}

// ── APNs (iOS) ───────────────────────────────────────────────────────────────
let _apnsJwt: { token: string; iat: number } | null = null

function getApnsJwt(): string | null {
  const keyId = process.env.APNS_KEY_ID
  const teamId = process.env.APNS_TEAM_ID
  let key = process.env.APNS_PRIVATE_KEY
  if (!keyId || !teamId || !key) return null
  key = key.replace(/\\n/g, '\n')   // env 에 \n 이스케이프로 저장된 경우 복원
  const nowSec = Math.floor(Date.now() / 1000)
  if (_apnsJwt && nowSec - _apnsJwt.iat < 3000) return _apnsJwt.token   // <1h 재사용
  try {
    const token = jwt.sign({ iss: teamId, iat: nowSec }, key, {
      algorithm: 'ES256', header: { alg: 'ES256', kid: keyId },
    })
    _apnsJwt = { token, iat: nowSec }
    return token
  } catch (e) {
    console.warn('[push-native] APNs JWT sign failed', e)
    return null
  }
}

interface ApnsResult { token: string; ok: boolean; dead: boolean; error?: string }

async function sendApnsBatch(
  tokens: string[], title: string, body: string, url: string,
): Promise<ApnsResult[]> {
  const jwtToken = getApnsJwt()
  const bundleId = process.env.APNS_BUNDLE_ID
  if (!jwtToken || !bundleId) return tokens.map(t => ({ token: t, ok: false, dead: false, error: 'apns_not_configured' }))
  const host = process.env.APNS_PRODUCTION === 'false'
    ? 'https://api.sandbox.push.apple.com'
    : 'https://api.push.apple.com'

  return new Promise<ApnsResult[]>((resolve) => {
    const results: ApnsResult[] = []
    const client = http2.connect(host)
    let pending = tokens.length
    let settled = false
    const finish = () => { if (!settled) { settled = true; try { client.close() } catch { /* noop */ } ; resolve(results) } }
    client.on('error', (err) => {
      for (const t of tokens) if (!results.find(r => r.token === t)) results.push({ token: t, ok: false, dead: false, error: err.message })
      finish()
    })
    const payload = JSON.stringify({ aps: { alert: { title, body }, sound: 'default' }, url })
    for (const token of tokens) {
      const req = client.request({
        ':method': 'POST',
        ':path': `/3/device/${token}`,
        authorization: `bearer ${jwtToken}`,
        'apns-topic': bundleId,
        'apns-push-type': 'alert',
        'content-type': 'application/json',
      })
      let status = 0
      let respBody = ''
      req.on('response', (h) => { status = Number(h[':status']) || 0 })
      req.on('data', (c) => { respBody += c })
      req.on('end', () => {
        if (status === 200) results.push({ token, ok: true, dead: false })
        else {
          const dead = status === 410 || /BadDeviceToken|Unregistered/i.test(respBody)
          results.push({ token, ok: false, dead, error: `${status} ${respBody.slice(0, 160)}` })
        }
        if (--pending === 0) finish()
      })
      req.on('error', (err) => {
        results.push({ token, ok: false, dead: false, error: err.message })
        if (--pending === 0) finish()
      })
      req.end(payload)
    }
    if (tokens.length === 0) finish()
  })
}

// ── 통합 발송 ────────────────────────────────────────────────────────────────
export interface NativeSendOptions {
  service: SupabaseClient
  userIds: string[]
  type: string
  title: string
  body?: string
  url?: string
  clubId?: string | null
  sentBy?: string | null
  // 웹 루프와 동일한 preference 게이트를 재현하기 위해 전달
  prefMap: Map<string, any>
  prefCol: string
  skipPreferenceCheck?: boolean
  // 로그를 여기에 append (호출부 push-server 가 일괄 insert)
  logRows: any[]
}

export async function sendNativePush(opts: NativeSendOptions): Promise<void> {
  const { service, userIds, type, title, body, url, clubId, sentBy, prefMap, prefCol, skipPreferenceCheck, logRows } = opts
  if (userIds.length === 0) return

  const fcmConfigured  = !!process.env.FCM_SERVICE_ACCOUNT && !!process.env.FCM_PROJECT_ID
  const apnsConfigured = !!process.env.APNS_KEY_ID && !!process.env.APNS_TEAM_ID && !!process.env.APNS_PRIVATE_KEY && !!process.env.APNS_BUNDLE_ID
  if (!fcmConfigured && !apnsConfigured) return   // 아직 준비 안 됨 → 웹푸시만

  // preference 통과한 유저만 (웹 루프와 동일 규칙). 스킵 유저는 웹 루프가 이미 로깅.
  const eligible = new Set<string>()
  for (const uid of userIds) {
    if (skipPreferenceCheck) { eligible.add(uid); continue }
    const p = prefMap.get(uid)
    if (!p) { eligible.add(uid); continue }   // 설정 없음 = 기본 허용
    const masterOff = !p.all_enabled
    const catOff = prefCol !== 'all_enabled' && p[prefCol] === false
    if (!masterOff && !catOff) eligible.add(uid)
  }
  if (eligible.size === 0) return

  const { data: tokens } = await service.from('device_push_tokens')
    .select('user_id, platform, token')
    .in('user_id', Array.from(eligible))
  if (!tokens || tokens.length === 0) return

  const bodyStr = body ?? ''
  const urlStr  = url ?? '/'
  const deadTokens: string[] = []

  const log = (uid: string, ok: boolean, hint: string, err?: string) => {
    logRows.push({
      user_id: uid, club_id: clubId ?? null, type, title, body: body ?? null, url: url ?? null,
      status: ok ? 'success' : 'failed',
      error_code: ok ? null : 'native_error',
      error_message: err ? err.slice(0, 500) : null,
      endpoint_hint: hint, sent_by: sentBy ?? null,
    })
  }

  // Android → FCM
  const androidRows = tokens.filter((t: any) => t.platform === 'android')
  if (androidRows.length && fcmConfigured) {
    const accessToken = await getFcmAccessToken()
    const projectId = process.env.FCM_PROJECT_ID!
    if (accessToken) {
      for (const row of androidRows) {
        const r = await sendFcm(projectId, accessToken, row.token, title, bodyStr, urlStr)
        log(row.user_id, r.ok, `fcm:${String(row.token).slice(0, 12)}`, r.error)
        if (r.dead) deadTokens.push(row.token)
      }
    }
  }

  // iOS → APNs (배치 — http2 세션 1개 재사용)
  const iosRows = tokens.filter((t: any) => t.platform === 'ios')
  if (iosRows.length && apnsConfigured) {
    const results = await sendApnsBatch(iosRows.map((t: any) => t.token), title, bodyStr, urlStr)
    const byToken = new Map(results.map(r => [r.token, r]))
    for (const row of iosRows) {
      const r = byToken.get(row.token)
      log(row.user_id, !!r?.ok, `apns:${String(row.token).slice(0, 12)}`, r?.error)
      if (r?.dead) deadTokens.push(row.token)
    }
  }

  // 죽은 토큰 정리
  if (deadTokens.length) {
    await service.from('device_push_tokens').delete().in('token', deadTokens)
  }
}
