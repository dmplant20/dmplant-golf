import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

function getAdmin() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

export async function POST(req: NextRequest) {
  const { email } = await req.json()
  if (!email) return NextResponse.json({ error: 'email required' }, { status: 400 })

  const admin = getAdmin()
  const { data } = await admin
    .from('users')
    .select('needs_password_reset')
    .eq('email', email.toLowerCase().trim())
    .single()

  if (!data) {
    return NextResponse.json({ exists: false, firstTime: false })
  }

  return NextResponse.json({
    exists: true,
    firstTime: data.needs_password_reset === true,
  })
}
