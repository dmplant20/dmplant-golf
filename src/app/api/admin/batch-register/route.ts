import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'

function getAdmin() {
  return createServiceClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  )
}

// 노출되지 않는 랜덤 내부 비밀번호 (첫 로그인은 매직링크로 진행)
function randomInternalPassword() {
  return crypto.randomUUID() + crypto.randomUUID()
}

export async function POST(req: NextRequest) {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } }
  )
  const { data: { user: caller } } = await supabase.auth.getUser()
  if (!caller) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  const admin = getAdmin()

  // is_developer 확인
  const { data: callerProfile } = await admin
    .from('users').select('is_developer').eq('id', caller.id).single()
  if (!callerProfile?.is_developer) {
    return NextResponse.json({ error: '개발자만 사용 가능' }, { status: 403 })
  }

  const { club_name, members } = await req.json()
  if (!club_name || !members?.length) {
    return NextResponse.json({ error: 'club_name, members 필요' }, { status: 400 })
  }

  // 클럽 ID 조회
  const { data: club } = await admin
    .from('clubs').select('id').eq('name', club_name).single()
  if (!club) return NextResponse.json({ error: `클럽 없음: ${club_name}` }, { status: 404 })

  const results: any[] = []

  for (const m of members) {
    const { full_name, full_name_en, name_abbr, email, role } = m
    try {
      // Auth 계정 생성 (임시 비번 없음 — 첫 로그인은 매직링크로)
      const { data: created, error: createErr } = await admin.auth.admin.createUser({
        email,
        password: randomInternalPassword(),
        email_confirm: true,
      })

      let userId: string

      if (createErr) {
        if (createErr.message?.toLowerCase().includes('already')) {
          const { data: existing } = await admin
            .from('users').select('id').eq('email', email).single()
          if (!existing) {
            results.push({ email, full_name, ok: false, error: createErr.message })
            continue
          }
          userId = existing.id
          // 기존 계정도 첫 로그인 플래그 설정
          await admin.from('users').update({ needs_password_reset: true }).eq('id', userId)
        } else {
          results.push({ email, full_name, ok: false, error: createErr.message })
          continue
        }
      } else {
        userId = created.user.id
        // upsert: 트리거가 먼저 row를 만들어도 올바른 이름으로 덮어씀
        await admin.from('users').upsert({
          id: userId, email, full_name,
          full_name_en: full_name_en || null,
          name_abbr: name_abbr || null,
          needs_password_reset: true,
        }, { onConflict: 'id' })
      }

      // 멤버십 생성 (이미 있으면 skip)
      const { data: existingMem } = await admin
        .from('club_memberships')
        .select('id').eq('club_id', club.id).eq('user_id', userId).single()

      if (!existingMem) {
        await admin.from('club_memberships').insert({
          club_id: club.id, user_id: userId,
          role, status: 'approved',
          joined_at: new Date().toISOString(),
        })
      }

      results.push({ email, full_name, ok: true })
    } catch (e: any) {
      results.push({ email, full_name, ok: false, error: e.message })
    }
  }

  return NextResponse.json({ results })
}
