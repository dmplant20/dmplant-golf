import { createClient } from '@supabase/supabase-js'
import fs from 'node:fs'
fs.readFileSync('.env.local','utf8').split('\n').forEach(l=>{const m=l.match(/^([A-Z_]+)=(.*)$/);if(m)process.env[m[1]]=m[2].replace(/^["']|["']$/g,'')})
const a=createClient(process.env.NEXT_PUBLIC_SUPABASE_URL,process.env.SUPABASE_SERVICE_ROLE_KEY,{auth:{persistSession:false}})

const {data:c}=await a.from('clubs').select('id').eq('name','MGF').single()
const {data:pat}=await a.from('recurring_meetings').select('*').eq('club_id',c.id).maybeSingle()
const {data:ovs}=await a.from('meeting_overrides').select('*').eq('club_id',c.id)
console.log('pattern:', pat)
console.log('overrides (5월):', (ovs??[]).filter(o=>o.year===2026&&o.month===5))

function getNth(y,m,w,dow){
  const f=new Date(y,m-1,1)
  let diff=dow-f.getDay(); if(diff<0)diff+=7
  const day=1+diff+(w-1)*7
  if(day>new Date(y,m,0).getDate()) return null
  return new Date(y,m-1,day)
}
const today=new Date('2026-05-11T00:00:00')
const may = pat ? getNth(2026,5,pat.week_of_month,pat.day_of_week) : null
console.log('5월 월례회 일자:', may?.toISOString().slice(0,10))
console.log('오늘 :', today.toISOString().slice(0,10))
const cutoff = !pat ? 5 : (may && today>may ? 5 : 4)
console.log('cutoffMonth:', cutoff)
