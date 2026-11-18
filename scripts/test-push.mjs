// 본인 구독으로 직접 푸시 발송 테스트 — VAPID 매칭 + 전송 경로 검증
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})

const pub  = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '').trim().replace(/^["']|["']$/g, '').replace(/\s+/g, '')
const priv = process.env.VAPID_PRIVATE_KEY?.trim()
const mail = process.env.VAPID_EMAIL ?? 'mailto:admin@example.com'

console.log('VAPID public 키 길이:', pub.length, '— 정상은 87자')
console.log('VAPID private 키 길이:', priv?.length, '— 정상은 43자')
console.log('VAPID public 형식:', /^[A-Za-z0-9_-]+$/.test(pub) ? '✓ base64url' : '❌ 잘못된 문자 포함')

webpush.setVapidDetails(mail, pub, priv)

const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{autoRefreshToken:false,persistSession:false}})
const { data: subs } = await a.from('push_subscriptions')
  .select('user_id,endpoint,p256dh,auth,users(full_name,email)')

console.log()
console.log(`총 구독자: ${subs?.length}`)
console.log()

const payload = JSON.stringify({
  title: '🧪 푸시 테스트',
  body: '이 메시지가 보이면 푸시 발송 경로 정상',
  url: '/dashboard',
})

for (const s of (subs ?? [])) {
  const u = Array.isArray(s.users) ? s.users[0] : s.users
  process.stdout.write(`→ ${u?.full_name ?? '?'} (${(u?.email ?? '').slice(0,20)}) ... `)
  try {
    await webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      payload,
      { TTL: 3600 }
    )
    console.log('✓ 전송 성공')
  } catch (err) {
    console.log(`❌ ${err.statusCode} — ${err.message?.slice(0,80)}`)
    if (err.statusCode === 410 || err.statusCode === 404) {
      console.log('   (만료된 구독 — DB 에서 삭제 권장)')
    } else if (err.statusCode === 403) {
      console.log('   (VAPID 키 불일치 — 서버와 클라이언트의 NEXT_PUBLIC_VAPID_PUBLIC_KEY 동기화 필요)')
    }
  }
}
