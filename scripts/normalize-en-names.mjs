import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const INITIALS=['g','kk','n','d','tt','r','m','b','pp','s','ss','','j','jj','ch','k','t','p','h']
const VOWELS=['a','ae','ya','yae','eo','e','yeo','ye','o','wa','wae','oe','yo','u','wo','we','wi','yu','eu','ui','i']
const FINALS=['','k','k','ks','n','nj','nh','t','l','lk','lm','lp','ls','lt','lp','lh','m','p','ps','s','ss','ng','j','ch','k','t','p','h']
function romanize(input){
  if(!input) return ''
  const parts=[]
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
  return parts.filter(Boolean).join(' ')
}
const cap = s => s ? s[0].toUpperCase()+s.slice(1).toLowerCase() : ''
function format(input){
  if(!input) return ''
  const base = /[가-힣]/.test(input) ? romanize(input) : input
  const parts = base.replace(/[-_]+/g,' ').trim().split(/\s+/).filter(Boolean)
  if(!parts.length) return ''
  if(parts.length===1) return cap(parts[0])
  return cap(parts[0]) + ' ' + cap(parts.slice(1).join('').toLowerCase())
}

console.log('=== users 정규화 ===')
const {data:users}=await a.from('users').select('id,full_name,full_name_en')
let changed=0
for(const u of users){
  const src = (u.full_name_en && !/[가-힣]/.test(u.full_name_en)) ? u.full_name_en : u.full_name
  if(!src) continue
  const next = format(src)
  if(!next || next === u.full_name_en) continue
  await a.from('users').update({full_name_en:next}).eq('id',u.id)
  console.log(`  ${u.full_name?.padEnd(8)} "${u.full_name_en??''}" → "${next}"`)
  changed++
}
console.log(`users 변경: ${changed}건\n`)

console.log('=== meeting_guests 정규화 ===')
const {data:gs}=await a.from('meeting_guests').select('id,full_name,full_name_en')
let changedG=0
for(const g of gs){
  const src = (g.full_name_en && !/[가-힣]/.test(g.full_name_en)) ? g.full_name_en : g.full_name
  if(!src) continue
  const next = format(src)
  if(!next || next === g.full_name_en) continue
  await a.from('meeting_guests').update({full_name_en:next}).eq('id',g.id)
  console.log(`  ${g.full_name?.padEnd(8)} "${g.full_name_en??''}" → "${next}"`)
  changedG++
}
console.log(`guests 변경: ${changedG}건`)
