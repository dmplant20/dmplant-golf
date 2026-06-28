import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { isSuperAdmin } from '@/lib/superAdmin'

// 점수 (round_scores) + 자동 벌금 (finance_transactions) 통합 저장
//
// 권한 체계 — 회장님 명시 요구사항:
//   - 수정: super_admin (개발자) | president | secretary (어느 클럽이든)
//   - 일반회원: 본인 점수만 수정 가능
//
// RLS 우회 — service_role 로 service-side INSERT
// (DB RLS 는 super_admin email 을 모르므로 server 에서 권한 체크 후 service_role 사용)

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

interface ScoreItem {
  user_id: string
  gross_score: number
  handicap_used: number | null
}

export async function POST(req: NextRequest) {
  const user = await getAuthUser()
  if (!user) return NextResponse.json({ error: '로그인 필요' }, { status: 401 })

  let body: any
  try { body = await req.json() } catch { return NextResponse.json({ error: 'invalid body' }, { status: 400 }) }
  const {
    club_id,
    year,
    month,
    played_at,
    course_name,
    course_par,
    scores,             // ScoreItem[]
    absent_user_ids,    // string[]  (결장 벌금 대상)
    fine_per_stroke,    // number
    fine_max,           // number
    absence_fine_amount, // number
  } = body as {
    club_id: string
    year: number
    month: number
    played_at: string
    course_name: string | null
    course_par: number
    scores: ScoreItem[]
    absent_user_ids?: string[]
    fine_per_stroke?: number
    fine_max?: number
    absence_fine_amount?: number
  }

  if (!club_id || !year || !month || !played_at) {
    return NextResponse.json({ error: '필수값 누락 (club_id/year/month/played_at)' }, { status: 400 })
  }
  if (!Array.isArray(scores) || scores.length === 0) {
    return NextResponse.json({ error: '점수가 없습니다' }, { status: 400 })
  }

  const db = getDb()
  const admin = isSuperAdmin(user)

  // 권한 체크 — admin 외에는 클럽 멤버여야 함
  const { data: mem } = await db.from('club_memberships')
    .select('id, role').eq('club_id', club_id).eq('user_id', user.id).eq('status', 'approved').maybeSingle()
  if (!mem && !admin) return NextResponse.json({ error: '클럽 멤버가 아닙니다' }, { status: 403 })

  const isOfficer = mem && ['president', 'secretary'].includes((mem as any).role)
  const canEditOthers = admin || isOfficer

  // 일반 회원: 본인 점수만 — scores 배열에 자기 외 user_id 있으면 거부
  if (!canEditOthers) {
    const others = scores.filter(s => s.user_id !== user.id)
    if (others.length > 0) {
      return NextResponse.json({ error: '회장·총무·개발자만 다른 회원 점수를 수정할 수 있습니다' }, { status: 403 })
    }
    if ((absent_user_ids ?? []).length > 0) {
      return NextResponse.json({ error: '결장 벌금은 회장·총무·개발자만 등록할 수 있습니다' }, { status: 403 })
    }
  }

  // round_scores upsert (각 회원별)
  const errors: string[] = []
  let saved = 0
  for (const s of scores) {
    const gross = Number(s.gross_score)
    if (isNaN(gross) || gross < 60 || gross > 150) {
      errors.push(`${s.user_id.slice(0,8)}: 잘못된 점수 ${s.gross_score}`)
      continue
    }
    const hc = s.handicap_used != null ? Number(s.handicap_used) : null
    const net = hc != null ? gross - hc : null
    const { error: upErr } = await db.from('round_scores').upsert({
      club_id,
      user_id:       s.user_id,
      year,
      month,
      gross_score:   gross,
      handicap_used: hc,
      net_score:     net,
      course_name,
      course_par,
      played_at,
      recorded_by:   user.id,
    }, { onConflict: 'club_id,user_id,year,month' })
    if (upErr) { errors.push(`${s.user_id.slice(0,8)}: ${upErr.message}`); continue }
    saved++
  }

  // 자동 벌금 — 핸디 초과 + 결장
  const fineRows: any[] = []
  const perStroke = Number(fine_per_stroke ?? 0) || 0
  const fineMax   = Number(fine_max ?? 0) || 0
  const absenceFineAmt = Number(absence_fine_amount ?? 0) || 0

  // 자동 발생 벌금 — [미납] prefix 로 미수금 상태 표시 (잔고 합산 X)
  // 회장/총무 가 finance 화면에서 "✓ 수납 확인" 누르면 prefix 제거 → 잔고 합산
  if (perStroke > 0) {
    for (const s of scores) {
      const gross = Number(s.gross_score)
      const hc = s.handicap_used != null ? Number(s.handicap_used) : null
      const net = hc != null ? gross - hc : null
      if (net == null || net <= course_par) continue
      const overPar = net - course_par
      let amount = overPar * perStroke
      if (fineMax > 0 && amount > fineMax) amount = fineMax
      fineRows.push({
        club_id,
        member_id:        s.user_id,
        type:             'fine',
        amount,
        description:      `[미납] ${year}-${month} 월례회 핸디 초과 (over par ${overPar}타)`,
        transaction_date: played_at,
        recorded_by:      user.id,
      })
    }
  }
  if (absenceFineAmt > 0 && canEditOthers) {
    for (const uid of (absent_user_ids ?? [])) {
      fineRows.push({
        club_id,
        member_id:        uid,
        type:             'fine',
        amount:           absenceFineAmt,
        description:      `[미납] ${year}-${month} 월례회 결장`,
        transaction_date: played_at,
        recorded_by:      user.id,
      })
    }
  }

  // 일괄 갱신 — 동일 날짜 기존 월례회 fine 모두 삭제 후 신규 INSERT
  // 이미 수납 완료된 (prefix 없는) fine 도 같이 삭제 — 재계산 결과로 재INSERT 되어야 함
  // 수납 상태는 별도 보존 안 함 (점수/멤버 명단 변경 시 재산정)
  let fineCount = 0
  if (fineRows.length > 0) {
    await db.from('finance_transactions').delete()
      .eq('club_id', club_id).eq('type', 'fine').eq('transaction_date', played_at)
      .or(`description.ilike.${year}-${month} 월례회%,description.ilike.[미납] ${year}-${month} 월례회%`)
    const { error: fErr, data: fData } = await db.from('finance_transactions').insert(fineRows).select('id')
    if (fErr) errors.push(`벌금 자동 등록 실패: ${fErr.message}`)
    else fineCount = fData?.length ?? fineRows.length
  }

  return NextResponse.json({
    ok: errors.length === 0,
    saved,
    fines: fineCount,
    errors: errors.length > 0 ? errors : undefined,
  })
}
