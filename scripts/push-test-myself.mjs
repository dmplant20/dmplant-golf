// 본인에게 직접 푸시 — 휴대폰 OS 팝업이 정말 뜨는지 확인
import webpush from 'web-push'
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})

const pub  = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY?.trim()
const priv = process.env.VAPID_PRIVATE_KEY?.trim()
webpush.setVapidDetails(process.env.VAPID_EMAIL ?? 'mailto:admin@example.com', pub, priv)

const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } })

const { data: me } = await a.from('users').select('id,full_name,email').eq('email','dmplant@naver.com').single()
console.log('대상:', me?.full_name, me?.email)

const { data: subs } = await a.from('push_subscriptions').select('endpoint,p256dh,auth,created_at').eq('user_id', me.id)
console.log(`구독 수: ${subs?.length}`)

if (!subs?.length) {
  console.log('❌ 구독 없음 — PWA 에서 알림 받기를 활성화해야 합니다')
  process.exit(0)
}

const payload = JSON.stringify({
  title: '🔔 휴대폰 팝업 테스트',
  body: '이 메시지가 폰 화면 위에 팝업으로 떴으면 푸시 정상 동작',
  url: '/dashboard',
})

for (const s of subs) {
  process.stdout.write(`→ ${new Date(s.created_at).toLocaleString('ko-KR')} 구독 ... `)
  try {
    const result = await webpush.sendNotification(
      { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
      payload,
      { TTL: 3600 }
    )
    console.log('✓', result.statusCode || 'sent')
  } catch (err) {
    console.log(`❌ ${err.statusCode} — ${(err.message ?? '').slice(0,80)}`)
  }
}
