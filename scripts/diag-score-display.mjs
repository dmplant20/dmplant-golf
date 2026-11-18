import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } })

const CLUB300 = '59138dad-8bf6-47e9-81df-8f47d6a45143'
const MGF     = '0b9b3498-f5c0-42a2-8fa2-1eafeafbf206'

for (const club of [{ id: MGF, name: 'MGF' }, { id: CLUB300, name: '300' }]) {
  console.log(`\n━━━ ${club.name} 클럽 2026-06 ━━━`)

  // 1. 참석/불참 응답
  const { data: att } = await a.from('meeting_attendances').select('*, users:user_id(full_name)')
    .eq('club_id', club.id).eq('year', 2026).eq('month', 6)
  const attending = att?.filter(x => x.status === 'attending') ?? []
  const absent = att?.filter(x => x.status === 'absent') ?? []
  console.log(`  참석 ${attending.length}명: ${attending.map(x => x.users?.full_name).join(', ')}`)
  console.log(`  불참 ${absent.length}명: ${absent.map(x => x.users?.full_name).join(', ')}`)

  // 2. 저장된 스코어
  const { data: sc } = await a.from('round_scores')
    .select('user_id, gross_score, handicap_used, net_score, users:user_id(full_name)')
    .eq('club_id', club.id).eq('year', 2026).eq('month', 6)
  console.log(`  스코어 ${sc?.length ?? 0}건:`)
  sc?.forEach(s => console.log(`    ${s.users?.full_name}: gross=${s.gross_score} hc=${s.handicap_used} net=${s.net_score}`))

  // 3. 매칭 — 스코어 있는데 attending 명단에 없는 회원
  const attUserIds = new Set(attending.map(x => x.user_id))
  const orphans = (sc ?? []).filter(s => !attUserIds.has(s.user_id))
  if (orphans.length) {
    console.log(`  ⚠ 스코어 있는데 참석 응답 없는 회원 ${orphans.length}명:`)
    orphans.forEach(o => console.log(`    ${o.users?.full_name} score=${o.gross_score}  → 화면에 안 나타남 (attending.map 에서 누락)`))
  }
}
