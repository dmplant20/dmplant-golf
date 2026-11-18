import webpush from 'web-push'
import { createClient } from '@/lib/supabase/server'
import { selfPushTest } from '@/lib/push/self-test'

export async function POST(request: Request) {
  try {
    const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const privateKey = process.env.VAPID_PRIVATE_KEY
    return await selfPushTest(request, await createClient(), async subscription => {
      await webpush.sendNotification({ endpoint: subscription.endpoint, keys: { p256dh: subscription.p256dh, auth: subscription.auth } },
        JSON.stringify({ title: 'IS Golf 알림 테스트', body: '본인 기기에 대한 알림 테스트입니다.', url: '/' }),
        { TTL: 60, timeout: 5000, vapidDetails: { subject: process.env.VAPID_EMAIL ?? 'mailto:admin@example.com', publicKey: publicKey!, privateKey: privateKey! } })
    }, Boolean(publicKey && privateKey))
  } catch {
    return Response.json({ error: 'PUSH_UNAVAILABLE' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
}
