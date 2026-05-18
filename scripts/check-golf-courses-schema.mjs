import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

// 1) golf_courses 존재 확인 + 컬럼 추출
const { data, error } = await a.from('golf_courses').select('*').limit(1)
if (error) {
  console.log('❌ golf_courses 테이블 조회 실패:', error.message)
  if (error.message.includes('does not exist')) {
    console.log('   → 마이그레이션 전체가 적용 안 됨')
  }
} else {
  console.log('✓ golf_courses 테이블 존재. 컬럼:', data?.[0] ? Object.keys(data[0]).join(', ') : '(데이터 없음)')
}

// 2) name_vn 컬럼만 명시해서 조회 시도
const { data: d2, error: e2 } = await a.from('golf_courses').select('id, name, name_vn').limit(1)
console.log('\nname_vn 조회 시도:', e2?.message ?? `✓ 정상 (${d2?.length}행)`)

// 3) 총 행 수
const { count } = await a.from('golf_courses').select('*', { count: 'exact', head: true })
console.log('총 골프장 수:', count)

// 4) 300 클럽 정기모임 패턴 확인
console.log('\n▶ 300 클럽 recurring_meetings:')
const { data: clubs } = await a.from('clubs').select('id,name').eq('name','300').single()
const { data: pat } = await a.from('recurring_meetings').select('*').eq('club_id', clubs.id).maybeSingle()
console.log(pat ?? '(없음)')

console.log('\n▶ MGF 클럽 recurring_meetings:')
const { data: mgf } = await a.from('clubs').select('id,name').eq('name','MGF').single()
const { data: mgfPat } = await a.from('recurring_meetings').select('*').eq('club_id', mgf.id).maybeSingle()
console.log(mgfPat ?? '(없음)')
