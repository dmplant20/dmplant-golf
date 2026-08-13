import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// round_scores 컬럼 확인
const { data: sample } = await a.from('round_scores').select('*').limit(1)
console.log('round_scores 컬럼:', sample?.[0] ? Object.keys(sample[0]).join(', ') : '(빈 테이블)')

// 300 클럽 전체 — created_at 포함
const CLUB300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'
console.log('\n=== 300 클럽 round_scores (created_at) ===')
const { data: rs } = await a.from('round_scores').select('year, month, gross_score, created_at, recorded_by, users:user_id(full_name)').eq('club_id', CLUB300).order('created_at', { ascending: false })
rs?.forEach(r => console.log(`  ${r.year}-${r.month} ${r.users?.full_name} ${r.gross_score} created=${r.created_at}`))

// 전체 클럽에서 가장 최근 5건 (created_at desc) — 방금 시도 흔적 찾기
console.log('\n=== 전체 round_scores 최신 5건 (created_at) ===')
const { data: recent } = await a.from('round_scores').select('year, month, gross_score, created_at, clubs(name), users:user_id(full_name)').order('created_at', { ascending: false }).limit(5)
recent?.forEach(r => console.log(`  [${r.clubs?.name}] ${r.year}-${r.month} ${r.users?.full_name} ${r.gross_score} created=${r.created_at}`))
