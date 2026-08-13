'use client'
import { isNativeApp } from '@/lib/native'

// 네이티브(Capacitor) 푸시 등록 — FCM(Android)/APNs(iOS).
// 웹 브라우저에선 no-op. 로그인 후 (app)/layout 에서 호출.
// 채널 배타: 네이티브면 웹푸시(subscribePush)는 호출하지 않는다 → 중복 알림 없음.

let _registered = false

export async function registerNativePush(): Promise<void> {
  if (!isNativeApp() || _registered) return
  _registered = true
  try {
    const { PushNotifications } = await import('@capacitor/push-notifications')
    const { Capacitor } = await import('@capacitor/core')

    // 토큰 수신 → 서버 등록
    await PushNotifications.addListener('registration', async (t) => {
      try {
        await fetch('/api/push/register-device', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            platform: Capacitor.getPlatform(),
            token: t.value,
            app_version: process.env.NEXT_PUBLIC_BUILD_VERSION ?? null,
          }),
        })
      } catch (e) { console.warn('[push-native] register post failed', e) }
    })

    await PushNotifications.addListener('registrationError', (e) => {
      console.warn('[push-native] registration error', e)
    })

    // 포그라운드 수신 — presentationOptions(config)로 알림 자체는 표시됨. 여기선 특별 처리 없음.
    await PushNotifications.addListener('pushNotificationReceived', () => { /* foreground */ })

    // 알림 탭 → data.url 로 이동 (sw.js notificationclick 라우팅 미러)
    await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
      const data = action.notification?.data as { url?: string } | undefined
      const url = data?.url || '/'
      try { window.location.assign(new URL(url, window.location.origin).toString()) }
      catch { window.location.assign('/') }
    })

    // 권한 요청 → 등록
    let perm = await PushNotifications.checkPermissions()
    if (perm.receive === 'prompt' || perm.receive === 'prompt-with-rationale') {
      perm = await PushNotifications.requestPermissions()
    }
    if (perm.receive !== 'granted') { _registered = false; return }
    await PushNotifications.register()
  } catch (e) {
    _registered = false
    console.warn('[push-native] register failed', e)
  }
}
