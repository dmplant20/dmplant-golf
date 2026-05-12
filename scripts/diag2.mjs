// Storage RLS 진단 — anon 키(클라이언트와 동일)로 업로드 시도하여 RLS 차단 여부 확인
import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'

fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})

// 1) anon 키로 익명 클라 — 인증 없이 업로드 시도 (실패 예상)
const anon = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY)
const testFile = new Blob(['hello'], { type: 'text/plain' })
const r1 = await anon.storage.from('chat-attachments').upload('test/anon_test.txt', testFile, { upsert: true })
console.log('익명 업로드:', r1.error ? `❌ ${r1.error.message}` : '✓ 성공')

// 2) service_role 로 업로드 (RLS 우회, 성공해야 함)
const svc = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY)
const r2 = await svc.storage.from('chat-attachments').upload('test/svc_test.txt', testFile, { upsert: true })
console.log('서비스롤 업로드:', r2.error ? `❌ ${r2.error.message}` : '✓ 성공')

// 정리
await svc.storage.from('chat-attachments').remove(['test/svc_test.txt']).catch(() => {})

// 3) 정책 목록 — 익명으로는 불가, service role 도 storage.policies 직접 SELECT 안 됨
//    → SQL Editor 에서 SELECT * FROM pg_policies WHERE tablename='objects'; 로 확인 필요
console.log()
console.log('Storage 정책 확인:')
console.log('  Supabase SQL Editor 에서:')
console.log("  SELECT policyname, cmd FROM pg_policies WHERE schemaname='storage' AND tablename='objects' AND policyname LIKE 'chat_attach%';")
