// 푸시 시스템 다중트리 감사 — DB·RLS·구독·환경변수
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

console.log('━━━ A. 환경변수 ━━━')
const vapidPub = (process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? '').trim()
const vapidPriv = (process.env.VAPID_PRIVATE_KEY ?? '').trim()
console.log(`  NEXT_PUBLIC_VAPID_PUBLIC_KEY: ${vapidPub ? `✓ (${vapidPub.length}자, "${vapidPub.slice(0,12)}...")` : '❌ 없음'}`)
console.log(`  VAPID_PRIVATE_KEY           : ${vapidPriv ? `✓ (${vapidPriv.length}자)` : '❌ 없음'}`)
console.log(`  VAPID_EMAIL                 : ${process.env.VAPID_EMAIL ?? '(미설정 → admin@example.com 폴백)'}`)
console.log(`  SUPABASE_SERVICE_ROLE_KEY   : ${process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓' : '❌'}`)
console.log(`  CRON_SECRET                 : ${process.env.CRON_SECRET ? '✓' : '⚠ 없음 (cron 인증 미적용)'}`)

console.log('\n━━━ B. push_subscriptions 테이블 ━━━')
const { data: subs1, error: subsErr } = await a.from('push_subscriptions').select('*').limit(1)
if (subsErr) { console.log(`  ❌ ${subsErr.message}`); }
else if (subs1?.[0]) { console.log(`  ✓ 컬럼: ${Object.keys(subs1[0]).join(', ')}`) }
else { console.log('  ⚠ 빈 테이블') }

const { count: subCount } = await a.from('push_subscriptions').select('*', { count: 'exact', head: true })
console.log(`  총 구독 수: ${subCount ?? '?'}`)

const { data: byUser } = await a.from('push_subscriptions').select('user_id,endpoint,created_at').order('created_at', { ascending: false }).limit(20)
console.log(`  최근 ${byUser?.length ?? 0}건:`)
byUser?.forEach(s => console.log(`    user=${s.user_id.slice(0,8)} ep=${s.endpoint.slice(0,40)}... at=${s.created_at?.slice(0,10)}`))

// 회원 vs 구독 비교
console.log('\n━━━ C. 가입자 대비 구독 비율 ━━━')
const { data: users } = await a.from('users').select('id,full_name,email')
const { data: subsByUser } = await a.from('push_subscriptions').select('user_id')
const subscribedIds = new Set(subsByUser?.map(s => s.user_id))
const total = users?.length ?? 0
const withSub = users?.filter(u => subscribedIds.has(u.id)).length ?? 0
console.log(`  전체 회원: ${total}명 / 푸시 구독 활성화: ${withSub}명 (${Math.round(withSub/total*100)}%)`)

console.log('\n  구독 안 한 회원 목록 (모바일 알림 미수신 예상):')
users?.filter(u => !subscribedIds.has(u.id))
  .slice(0, 30)
  .forEach(u => console.log(`    - ${u.full_name} (${u.email})`))

console.log('\n━━━ D. notification_logs 테이블 존재 여부 ━━━')
const { error: logErr } = await a.from('notification_logs').select('*').limit(1)
if (logErr) console.log(`  ❌ ${logErr.message}`)
else console.log(`  ✓ 존재`)

console.log('\n━━━ E. user_notification_preferences 테이블 ━━━')
const { error: prefErr } = await a.from('user_notification_preferences').select('*').limit(1)
if (prefErr) console.log(`  ❌ ${prefErr.message}`)
else console.log(`  ✓ 존재`)

console.log('\n━━━ F. push_subscriptions RLS 정책 (간접 확인) ━━━')
// service role 로는 우회됨. anon 으로 SELECT 시도해 차단 여부만 본다
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY, { auth: { persistSession: false } })
const { data: anonSubs, error: anonErr } = await anon.from('push_subscriptions').select('*')
console.log(`  anon SELECT: ${anonErr?.message ?? `${anonSubs?.length}건 (RLS 미설정 가능)`}`)

console.log('\n━━━ 감사 종료 ━━━')
