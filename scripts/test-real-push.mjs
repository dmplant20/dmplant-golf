// 실제 푸시 발송 테스트 — 최성복(dmplant, club president) 의 구독 endpoint 로 직접 발송
// VAPID + webpush + FCM 까지의 체인이 실제 동작하는지 확인
import { createClient } from '@supabase/supabase-js'
import webpush from 'web-push'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})

const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

webpush.setVapidDetails(
  process.env.VAPID_EMAIL ?? 'mailto:admin@example.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY,
)

console.log('▶ VAPID 초기화 완료')
console.log(`  email: ${process.env.VAPID_EMAIL}`)
console.log(`  pub : ${process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.slice(0,20)}... (${process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY.length}자)`)
console.log()

// 최성복 (dmplant) 구독 가져오기
const DMPLANT_ID = '78392f9f-c048-423f-8cf8-1ade740cc2f9'
const { data: subs } = await a.from('push_subscriptions')
  .select('id, endpoint, p256dh, auth, created_at').eq('user_id', DMPLANT_ID)

console.log(`▶ 최성복(dmplant) 구독 ${subs?.length ?? 0}건:`)
subs?.forEach(s => console.log(`  [${s.id.slice(0,8)}] ${s.endpoint.slice(0,55)}... 생성=${s.created_at?.slice(0,10)}`))

if (!subs || subs.length === 0) { console.log('  ❌ 구독 없음 — 테스트 불가'); process.exit(1) }

const payload = JSON.stringify({
  title: '🔔 IS Golf 실시간 푸시 테스트',
  body: `${new Date().toLocaleString('ko-KR')} — 이 알림이 폰에 떴으면 푸시 시스템 정상`,
  url: '/dashboard',
})

console.log()
console.log('▶ 푸시 발송 시도...')
console.log(`  payload: ${payload}`)
console.log()

for (const s of subs) {
  process.stdout.write(`  endpoint ${s.endpoint.slice(0,45)}...`)
  try {
    const res = await webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      payload,
      { TTL: 86400 }
    )
    console.log(` ✅ status=${res.statusCode}`)
  } catch (err) {
    console.log(` ❌ status=${err.statusCode} ${err.body?.slice(0, 100) ?? err.message}`)
  }
}

console.log()
console.log('━━━ 결과 해석 ━━━')
console.log('  ✅ status=201 → FCM 큐에 들어감. 회장님 폰에 알림이 떠야 정상.')
console.log('  ❌ status=410 → 구독 endpoint 만료 (브라우저 PWA 가 재설치되었음). 회원이 알림 활성화 다시 켜야 함.')
console.log('  ❌ status=401/403 → VAPID 비밀키 잘못됨')
console.log('  ❌ status=404 → endpoint 무효')
