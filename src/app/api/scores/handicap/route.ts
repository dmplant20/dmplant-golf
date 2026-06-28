import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { isSuperAdmin } from '@/lib/superAdmin'

// 핸디 변경 + 현재 보고 있는 모임 round_scores 재계산 + 벌금 재계산
//
// 권한: super_admin | president | secretary (어느 클럽이든)
//   회장님 요구사항: "헨디가 수정되는 시점부터 그 헨디 확정"
//   - club_memberships.club_handicap 갱신 (앞으로 모든 계산의 기본값)
//   - 현재 viewing 모임의 round_scores 도 함께 갱신
//   - 그 모임의 자동 벌금도 재계산

async function getAuthUser() {
  const cookieStore = await cookies()
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    { cookies: { getAll: () => cookieStore.getAll(), setAll: () => {} } },
  )
  const { data: { user } } = await supabase.auth.getUser()
  return user
}

function getDb() {
  const svcKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (svcKey) return createServiceClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, svcKey, { auth: { persistSession: false } })
  return createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!, { cookies: { getAll: () => [], setAll: () => {} } })
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }) }
  const {
    club_id,
    target_user_id,
    new_handicap,    // number | null
    // 재계산 대상 모임 (회장님이 보고 있는 month)
    year,
    month,
    played_at,
    course_par,
    fine_per_stroke,
    fine_max,
  } = body as {
    club_id: string
    target_user_id: string
    new_handicap: number | null
    year?: number
    month?: number
    played_at?: string
    course_par?: number
    fine_per_stroke?: number
    fine_max?: number
  }

  if (!club_id || !target_user_id) {
    return NextResponse.json({ error: '필수값 누락 (club_id/target_user_id)' }, { status: 400 })
  }
  if (new_handicap != null && (new_handicap < 0 || new_handicap > 54)) {
    return NextResponse.json({ error: '핸디는 0~54' }, { status: 400 })
  }

  const db = getDb()
  const admin = isSuperAdmin(user)

  // 권한 — super_admin | president | secretary
  const { data: mem } = await db.from('club_memberships')
    .select('id, role').eq('club_id', club_id).eq('user_id', user.id).eq('status', 'approved').maybeSingle()
  const isOfficer = mem && ['president', 'secretary'].includes((mem as any).role)
  if (!admin && !isOfficer) {
    return NextResponse.json({ error: '핸디 수정은 회장·총무·개발자만 가능합니다' }, { status: 403 })
  }

  // 1) club_memberships.club_handicap 갱신
  const { error: hcErr } = await db.from('club_memberships')
    .update({ club_handicap: new_handicap })
    .eq('club_id', club_id).eq('user_id', target_user_id)
  if (hcErr) return NextResponse.json({ error: `핸디 저장 실패: ${hcErr.message}` }, { status: 500 })

  // 2) 현재 viewing 모임의 round_scores 가 있으면 함께 재계산
  let scoreUpdated = false
  let fineUpdated = 0
  if (year && month && played_at && course_par != null && new_handicap != null) {
    const { data: existing } = await db.from('round_scores')
      .select('gross_score')
      .eq('club_id', club_id).eq('user_id', target_user_id).eq('year', year).eq('month', month).maybeSingle()
    if (existing && (existing as any).gross_score != null) {
      const gross = (existing as any).gross_score
      const newNet = gross - new_handicap
      await db.from('round_scores').update({
        handicap_used: new_handicap,
        net_score:     newNet,
      }).eq('club_id', club_id).eq('user_id', target_user_id).eq('year', year).eq('month', month)
      scoreUpdated = true

      // 3) 벌금 재계산 — 룰 설정된 클럽만
      const perStroke = Number(fine_per_stroke ?? 0) || 0
      const fineMax   = Number(fine_max ?? 0) || 0
      if (perStroke > 0) {
        // 이 회원의 기존 핸디 벌금 삭제 (이전 [미납] prefix 도 정리)
        await db.from('finance_transactions').delete()
          .eq('club_id', club_id).eq('member_id', target_user_id).eq('type', 'fine')
          .or(`description.ilike.${year}-${month} 월례회 핸디%,description.ilike.[미납] ${year}-${month} 월례회 핸디%`)
        if (newNet > course_par) {
          const overPar = newNet - course_par
          let amount = overPar * perStroke
          if (fineMax > 0 && amount > fineMax) amount = fineMax
          await db.from('finance_transactions').insert({
            club_id,
            member_id:        target_user_id,
            type:             'fine',
            amount,
            description:      `[미납] ${year}-${month} 월례회 핸디 초과 (over par ${overPar}타)`,
            transaction_date: played_at,
            recorded_by:      user.id,
          })
          fineUpdated = 1
        }
      }
    }
  }

  return NextResponse.json({
    ok: true,
    handicap: new_handicap,
    scoreUpdated,
    fineUpdated,
  })
}
