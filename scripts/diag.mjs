import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, {auth:{autoRefreshToken:false,persistSession:false}})

console.log('=== 푸시 알림 ===')
const subRes = await a.from('push_subscriptions').select('user_id,endpoint,created_at')
console.log('  push_subscriptions 행 수:', subRes.data?.length, subRes.error ? `(에러: ${subRes.error.message})` : '')
subRes.data?.slice(0, 8).forEach(s => console.log('   -', s.user_id?.slice(0,8), '|', s.endpoint?.slice(0,55), '|', s.created_at?.slice(0,16)))

// 회원별 누가 구독했는지
const userIds = Array.from(new Set((subRes.data ?? []).map(s => s.user_id)))
if (userIds.length) {
  const { data: users } = await a.from('users').select('id,full_name,email').in('id', userIds)
  console.log('  구독한 회원:')
  users?.forEach(u => console.log('   -', u.full_name, '|', u.email))
}

console.log('\n=== 채팅 ===')
const r = await a.from('chat_rooms').select('id,type,name,club_id,last_message_at')
console.log('  chat_rooms:', r.data?.length, r.error ? `(에러: ${r.error.message})` : '')
r.data?.forEach(x => console.log('   -', x.type, '|', x.name, '|', 'last:', x.last_message_at?.slice(0,16) ?? '-'))

const m = await a.from('chat_messages').select('id,room_id,user_id,content,attachment_type,created_at').order('created_at',{ascending:false}).limit(10)
console.log('  chat_messages 최근 10건:', m.data?.length)
m.data?.forEach(x => console.log('   -', x.created_at?.slice(0,16), '|', x.user_id?.slice(0,8), '|', x.attachment_type ?? 'text', '|', (x.content ?? '').slice(0,30)))

const cm = await a.from('chat_room_members').select('room_id,user_id').limit(20)
console.log('  chat_room_members 최근 20건:', cm.data?.length, cm.error ? `(에러: ${cm.error.message})` : '')

console.log('\n=== Storage 버킷 ===')
const bucket = await a.storage.getBucket('chat-attachments')
console.log('  chat-attachments:', bucket.error ? '❌ ' + bucket.error.message : '✓ 존재')
if (bucket.data) console.log('   public=', bucket.data.public, '| size limit=', bucket.data.file_size_limit)

const list = await a.storage.from('chat-attachments').list('', { limit: 5 })
console.log('  업로드된 파일 수(최대 5):', list.data?.length, list.error ? `(에러: ${list.error.message})` : '')

console.log('\n=== 환경 변수 (로컬) ===')
console.log('  NEXT_PUBLIC_VAPID_PUBLIC_KEY:', process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ? '✓' : '❌')
console.log('  VAPID_PRIVATE_KEY:', process.env.VAPID_PRIVATE_KEY ? '✓' : '❌')
console.log('  VAPID_EMAIL:', process.env.VAPID_EMAIL ? '✓' : '❌')
console.log('  SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✓' : '❌')
