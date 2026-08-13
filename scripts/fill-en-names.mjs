import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const INITIALS=['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h']
const VOWELS=['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i']
const FINALS=['','k','k','ks','n','nj','nh','t','l','lk','lm','lp','ls','lt','lp','lh','m','p','ps','s','ss','ng','j','ch','k','t','p','h']
function romanizeSyllable(ch){
  const c=ch.charCodeAt(0)
  if(c<0xAC00||c>0xD7A3) return ch
  const n=c-0xAC00, i=Math.floor(n/588), v=Math.floor((n%588)/28), f=n%28
  return (INITIALS[i]??'')+(VOWELS[v]??'')+(FINALS[f]??'')
}
function romanize(input){
  if(!input) return ''
  const parts=[]
  let cur=''
  for(const ch of input){
    const c=ch.charCodeAt(0)
    if(c>=0xAC00&&c<=0xD7A3){ if(cur){parts.push(cur);cur=''}; parts.push(romanizeSyllable(ch)) }
    else if(/\s/.test(ch)){ if(cur){parts.push(cur);cur=''} }
    else cur+=ch
  }
  if(cur) parts.push(cur)
  return parts.filter(Boolean).map(p=>p[0].toUpperCase()+p.slice(1).toLowerCase()).join(' ')
}

// users 테이블 갱신
const {data:users}=await a.from('users').select('id,full_name,full_name_en')
let n=0
for(const u of users){
  if(u.full_name_en && !/[가-힣]/.test(u.full_name_en)) continue
  if(!u.full_name || !/[가-힣]/.test(u.full_name)) continue
  const en = romanize(u.full_name)
  if(!en) continue
  await a.from('users').update({full_name_en:en}).eq('id',u.id)
  console.log(`  users.${u.full_name} → "${en}"`)
  n++
}
console.log(`✓ users 갱신: ${n}건`)

// meeting_guests 테이블 갱신
const {data:gs}=await a.from('meeting_guests').select('id,full_name,full_name_en')
let m=0
for(const g of gs){
  if(g.full_name_en && !/[가-힣]/.test(g.full_name_en)) continue
  if(!g.full_name || !/[가-힣]/.test(g.full_name)) continue
  const en = romanize(g.full_name)
  if(!en) continue
  await a.from('meeting_guests').update({full_name_en:en}).eq('id',g.id)
  console.log(`  guests.${g.full_name} → "${en}"`)
  m++
}
console.log(`✓ guests 갱신: ${m}건`)
