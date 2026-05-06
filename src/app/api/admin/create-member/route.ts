import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

async function getAuthUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function getAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

function generateTempPassword(): string {
  const digits = Math.floor(1000 + Math.random() * 9000)
  return `Golf@${digits}`
}

export async function POST(req: NextRequest) {
  // 1. Auth check
  const caller = await getAuthUser()
  if (!caller) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const body = await req.json()
  const { club_id, full_name, full_name_en, name_abbr, email, role, tempPassword: providedPw } = body

  if (!club_id || !full_name || !email || !role) {
    return NextResponse.json({ error: '필수값 누락 (club_id, full_name, email, role)' }, { status: 400 })
  }

  const admin = getAdmin()

  // 2. Verify caller is president or secretary of this club
  const { data: callerMem } = await admin
    .from('club_memberships')
    .select('role')
    .eq('club_id', club_id)
    .eq('user_id', caller.id)
    .eq('status', 'approved')
    .single()

  if (!callerMem || !['president', 'secretary'].includes(callerMem.role)) {
    return NextResponse.json({ error: '권한 없음 (회장/총무만 가능)' }, { status: 403 })
  }

  const tempPassword = providedPw || generateTempPassword()

  // 3. Create auth user (or find existing)
  let authUserId: string

  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email,
    password: tempPassword,
    email_confirm: true,
  })

  if (createErr) {
    // If user already exists in auth, find them
    if (createErr.message?.toLowerCase().includes('already') || createErr.message?.toLowerCase().includes('duplicate')) {
      // Look up by email in public.users
      const { data: existingUser } = await admin
        .from('users')
        .select('id')
        .eq('email', email)
        .single()

      if (!existingUser) {
        return NextResponse.json({ error: `이미 등록된 이메일이지만 users 테이블에서 찾을 수 없습니다: ${createErr.message}` }, { status: 409 })
      }
      authUserId = existingUser.id

      // Check if already a member of this club
      const { data: existingMem } = await admin
        .from('club_memberships')
        .select('id')
        .eq('club_id', club_id)
        .eq('user_id', authUserId)
        .single()

      if (existingMem) {
        return NextResponse.json({ error: '이미 이 클럽의 회원입니다' }, { status: 409 })
      }
    } else {
      return NextResponse.json({ error: `계정 생성 실패: ${createErr.message}` }, { status: 500 })
    }
  } else {
    authUserId = created.user.id

    // 4. Insert into public.users
    const { error: userInsertErr } = await admin.from('users').insert({
      id: authUserId,
      email,
      full_name,
      full_name_en: full_name_en || null,
      name_abbr: name_abbr || null,
    })

    if (userInsertErr) {
      // Roll back auth user creation on failure
      await admin.auth.admin.deleteUser(authUserId)
      return NextResponse.json({ error: `users 테이블 삽입 실패: ${userInsertErr.message}` }, { status: 500 })
    }
  }

  // 5. Insert club membership
  const { error: memErr } = await admin.from('club_memberships').insert({
    club_id,
    user_id: authUserId,
    role,
    status: 'approved',
    joined_at: new Date().toISOString(),
  })

  if (memErr) {
    return NextResponse.json({ error: `멤버십 생성 실패: ${memErr.message}` }, { status: 500 })
  }

  return NextResponse.json({ ok: true, tempPassword, email, full_name })
}
