import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const INITIALS=['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h']
const VOWELS=['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i']
const FINALS=['','k','k','ks','n','nj','nh','t','l','lk','lm','lp','ls','lt','lp','lh','m','p','ps','s','ss','ng','j','ch','k','t','p','h']
function romanize(input){
  if(!input) return ''
  const parts=[], cap=s=>s?s[0].toUpperCase()+s.slice(1).toLowerCase():''
  let cur=''
  for(const ch of input){
    const c=ch.charCodeAt(0)
    if(c>=0xAC00&&c<=0xD7A3){
      if(cur){parts.push(cur);cur=''}
      const n=c-0xAC00, i=Math.floor(n/588), v=Math.floor((n%588)/28), f=n%28
      parts.push((INITIALS[i]??'')+(VOWELS[v]??'')+(FINALS[f]??''))
    } else if(/\s/.test(ch)){ if(cur){parts.push(cur);cur=''} }
    else cur+=ch
  }
  if(cur) parts.push(cur)
  const pp = parts.filter(Boolean).map(p=>cap(p))
  if(pp.length===0) return ''
  if(pp.length===1) return pp[0]
  return pp[0] + ' ' + pp.slice(1).join('')
}

const SEP = /\s*[,/&·、・]+\s*/

// 모든 게스트 행 점검 — 쉼표/슬래시 등 구분자가 들어있으면 분리
const {data:rows}=await a.from('meeting_guests').select('*')
console.log(`총 ${rows.length}건 점검 중...\n`)

let split=0, kept=0
for(const r of rows){
  const koNames = (r.full_name||'').split(SEP).map(s=>s.trim()).filter(Boolean)
  if(koNames.length <= 1){ kept++; continue }
  console.log(`▶ split: "${r.full_name}" → ${koNames.length}건`)
  // 기존 영문도 같은 구분자로 시도
  const enRaw = (r.full_name_en||'').split(SEP).map(s=>s.trim()).filter(Boolean)
  const enFor = (i) => {
    if(enRaw.length === koNames.length) return enRaw[i] || null
    return null
  }
  // 새 행들 생성 — 영문 없으면 자동 로마자
  const newRows = koNames.map((name, i) => {
    const en = enFor(i) || romanize(name) || null
    return {
      club_id: r.club_id, year: r.year, month: r.month,
      full_name: name,
      full_name_en: en,
      handicap: r.handicap,
      notes: r.notes,
      recommended_by: r.recommended_by,
      approved: r.approved,
      approved_by: r.approved_by,
      approved_at: r.approved_at,
    }
  })
  const {error:insErr}=await a.from('meeting_guests').insert(newRows)
  if(insErr){ console.error(`  insert 실패: ${insErr.message}`); continue }
  // 기존 행 삭제
  await a.from('meeting_guests').delete().eq('id', r.id)
  newRows.forEach((nr, i) => console.log(`  ✓ ${koNames[i]} → ${nr.full_name_en}`))
  split++
}

console.log(`\n결과: 분리 ${split}건, 유지 ${kept}건`)
