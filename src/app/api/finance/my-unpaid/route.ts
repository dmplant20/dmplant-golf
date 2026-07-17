// 로그인한 사용자의 회비/벌금 미납 내역 (본인 한정)
// — 어느 클럽이든 미납 1건 이상이면 클라가 팝업으로 알림
import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

async function makeSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )
}

interface UnpaidItem {
  club_id: string
  club_name: string
  fee_type: 'annual' | 'monthly'
  amount: number
  currency: string
  unpaid_months?: number[]   // monthly 일 때 미납 월 (1-12)
}
interface UnpaidFineItem {
  club_id: string
  club_name: string
  count: number
  total: number
  currency: string
}

export async function GET(_req: NextRequest) {
  const supabase = await makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const now = new Date()
  const year = now.getUTCFullYear()
  const currentMonth = now.getUTCMonth() + 1

  // ── 1. 내 모든 클럽 + fee_type 조회 ─────────────────────────────────────
  const { data: memberships } = await supabase
    .from('club_memberships')
    .select('club_id, fee_type, joined_at, clubs(id, name, annual_fee, monthly_fee, currency)')
    .eq('user_id', user.id)
    .eq('status', 'approved')

  const unpaidFees: UnpaidItem[] = []
  const unpaidFines: UnpaidFineItem[] = []

  for (const m of (memberships ?? [])) {
    const club = Array.isArray(m.clubs) ? m.clubs[0] : m.clubs
    if (!club) continue
    const feeType: 'annual' | 'monthly' | null = (m as any).fee_type ?? null
    const currency = club.currency ?? 'KRW'

    // ── 2. 회비 미납 ─────────────────────────────────────────────────────
    if (feeType) {
      const feeAmount = feeType === 'monthly' ? (club.monthly_fee ?? 0) : (club.annual_fee ?? 0)
      if (feeAmount > 0) {
        const yearStart = `${year}-01-01`
        const yearEnd = `${year + 1}-01-01`
        const { data: payments } = await supabase
          .from('finance_transactions')
          .select('transaction_date')
          .eq('club_id', m.club_id)
          .eq('member_id', user.id)
          .eq('type', 'fee')
          .gte('transaction_date', yearStart).lt('transaction_date', yearEnd)

        if (feeType === 'annual') {
          if (!payments || payments.length === 0) {
            unpaidFees.push({ club_id: m.club_id, club_name: club.name, fee_type: 'annual', amount: feeAmount, currency })
          }
        } else {
          // 가입월부터 미납 카운트 — 이전 연도 가입자는 1월부터
          const ja = (m as any).joined_at ? String((m as any).joined_at) : null
          const startMonth = (ja && ja.startsWith(String(year))) ? Number(ja.slice(5, 7)) : 1
          const paidMonths = new Set((payments ?? []).map((p: any) => Number(String(p.transaction_date).slice(5, 7))))

          // 월례회 통과 기준 — 이번 달 월례회 전이면 이번 달은 미납 카운트 제외
          let cutoffM = currentMonth
          const { data: pat } = await supabase
            .from('recurring_meetings')
            .select('week_of_month, day_of_week')
            .eq('club_id', m.club_id).maybeSingle()
          if (pat) {
            const { data: ovs } = await supabase
              .from('meeting_overrides')
              .select('status, override_date')
              .eq('club_id', m.club_id).eq('year', year).eq('month', currentMonth)
              .maybeSingle()
            const today = new Date(); today.setHours(0,0,0,0)
            let mtgD: Date | null = null
            if (ovs?.status === 'cancelled') mtgD = null
            else if (ovs?.status === 'rescheduled' && ovs.override_date) {
              mtgD = new Date(ovs.override_date + 'T00:00:00')
            } else {
              const first = new Date(year, currentMonth - 1, 1)
              let diff = pat.day_of_week - first.getDay(); if (diff < 0) diff += 7
              const day = 1 + diff + (pat.week_of_month - 1) * 7
              if (day <= new Date(year, currentMonth, 0).getDate()) {
                mtgD = new Date(year, currentMonth - 1, day)
              }
            }
            cutoffM = (mtgD && today > mtgD) ? currentMonth : (currentMonth - 1)
          }

          const unpaidMonths: number[] = []
          if (cutoffM >= startMonth) {
            for (let mm = startMonth; mm <= cutoffM; mm++) if (!paidMonths.has(mm)) unpaidMonths.push(mm)
          }
          if (unpaidMonths.length) {
            unpaidFees.push({
              club_id: m.club_id, club_name: club.name, fee_type: 'monthly',
              amount: feeAmount * unpaidMonths.length, currency, unpaid_months: unpaidMonths,
            })
          }
        }
      }
    }

    // ── 3. 벌금 미납 ──────────────────────────────────────────────────────
    // 미납 판정 = description 이 '[미납]' 으로 시작하는 행만.
    // 총무/회장이 "✓ 수납 확인" 하면 '[미납]' prefix 를 제거 → 납부 완료 → 팝업에서 사라짐.
    // (finance/page.tsx 의 isUnpaid / markFinePaid 와 동일한 규칙)
    const { data: fineRows } = await supabase
      .from('finance_transactions')
      .select('amount, description')
      .eq('club_id', m.club_id)
      .eq('member_id', user.id)
      .eq('type', 'fine')
    const unpaidRows = (fineRows ?? []).filter(
      (r: any) => typeof r.description === 'string' && r.description.startsWith('[미납]')
    )
    const fineSum = unpaidRows.reduce((s: number, r: any) => s + Number(r.amount ?? 0), 0)
    if (fineSum > 0) {
      unpaidFines.push({
        club_id: m.club_id, club_name: club.name,
        count: unpaidRows.length, total: fineSum, currency,
      })
    }
  }

  return NextResponse.json({
    unpaidFees,
    unpaidFines,
    has_any: unpaidFees.length > 0 || unpaidFines.length > 0,
  })
}
