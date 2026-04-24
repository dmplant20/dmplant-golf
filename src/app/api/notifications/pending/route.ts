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
        setAll: (list) => {
          list.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
        },
      },
    }
  )
}

/** Vietnam 현지 날짜 (UTC+7) */
function vietnamNow(): Date {
  return new Date(Date.now() + 7 * 60 * 60 * 1000)
}

function vietnamToday(): { year: number; month: number; day: number } {
  const now = vietnamNow()
  return { year: now.getUTCFullYear(), month: now.getUTCMonth() + 1, day: now.getUTCDate() }
}

/** week_of_month (1-5) + day_of_week (0=Sun) → UTC Date for that month */
function getNthWeekdayDate(
  year: number,
  month: number,
  week: number,
  dow: number
): Date | null {
  const first = new Date(Date.UTC(year, month - 1, 1))
  let diff = dow - first.getUTCDay()
  if (diff < 0) diff += 7
  const day = 1 + diff + (week - 1) * 7
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate()
  if (day > daysInMonth) return null
  return new Date(Date.UTC(year, month - 1, day))
}

/** Returns next meeting date on or after today for a given pattern */
function getNextMeetingDate(
  pattern: { week_of_month: number; day_of_week: number },
  todayYear: number,
  todayMonth: number,
  todayDay: number
): { date: Date; year: number; month: number } | null {
  // Try this month, then next
  for (let offset = 0; offset <= 1; offset++) {
    let y = todayYear
    let m = todayMonth + offset
    if (m > 12) { m = 1; y++ }
    const d = getNthWeekdayDate(y, m, pattern.week_of_month, pattern.day_of_week)
    if (!d) continue
    const dDay = d.getUTCDate()
    const dMonth = d.getUTCMonth() + 1
    const dYear = d.getUTCFullYear()
    // Is the meeting date on or after today?
    if (
      dYear > todayYear ||
      (dYear === todayYear && dMonth > todayMonth) ||
      (dYear === todayYear && dMonth === todayMonth && dDay >= todayDay)
    ) {
      return { date: d, year: dYear, month: dMonth }
    }
  }
  return null
}

export async function GET(_req: NextRequest) {
  const supabase = await makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { year: todayYear, month: todayMonth, day: todayDay } = vietnamToday()

  // ── Meeting check ────────────────────────────────────────────────────────

  let meetingResult: {
    clubId: string
    clubName: string
    year: number
    month: number
    meetingDate: string
    daysUntil: number
    venue: string | null
    time: string | null
  } | null = null

  try {
    // Get all clubs with meeting_patterns where user is approved member
    const { data: patterns, error: patternErr } = await supabase
      .from('meeting_patterns')
      .select('club_id, week_of_month, day_of_week, start_time, venue, clubs(id, name)')
      .not('club_id', 'is', null)

    if (!patternErr && patterns?.length) {
      // Filter to clubs where user is approved member
      const { data: memberships } = await supabase
        .from('club_memberships')
        .select('club_id')
        .eq('user_id', user.id)
        .eq('status', 'approved')

      const memberClubIds = new Set((memberships ?? []).map((m: any) => m.club_id))

      const todayUTC = Date.UTC(todayYear, todayMonth - 1, todayDay)

      for (const pattern of patterns) {
        if (!memberClubIds.has(pattern.club_id)) continue

        const next = getNextMeetingDate(
          {
            week_of_month: pattern.week_of_month ?? 1,
            day_of_week: pattern.day_of_week ?? 0,
          },
          todayYear,
          todayMonth,
          todayDay
        )
        if (!next) continue

        const diffMs = next.date.getTime() - todayUTC
        const daysUntil = Math.round(diffMs / (1000 * 60 * 60 * 24))
        if (daysUntil > 10) continue

        // Check if user already responded
        const { data: existing } = await supabase
          .from('meeting_attendances')
          .select('id')
          .eq('club_id', pattern.club_id)
          .eq('user_id', user.id)
          .eq('year', next.year)
          .eq('month', next.month)
          .maybeSingle()

        if (existing) continue

        const clubRec = Array.isArray(pattern.clubs) ? pattern.clubs[0] : pattern.clubs
        const clubName = clubRec?.name ?? pattern.club_id

        const dateStr = `${next.year}-${String(next.month).padStart(2, '0')}-${String(next.date.getUTCDate()).padStart(2, '0')}`

        meetingResult = {
          clubId: pattern.club_id,
          clubName,
          year: next.year,
          month: next.month,
          meetingDate: dateStr,
          daysUntil,
          venue: pattern.venue ?? null,
          time: pattern.start_time ?? null,
        }
        break // Show one at a time
      }
    }
  } catch (_e) {
    // meeting_patterns table may not exist yet — return gracefully
  }

  // ── Unpaid fee check ─────────────────────────────────────────────────────

  const unpaidFees: {
    clubId: string
    clubName: string
    feeType: string
    amount: number
    currency: string
  }[] = []

  try {
    const { data: memberships } = await supabase
      .from('club_memberships')
      .select('club_id, clubs(id, name, fee_type, annual_fee, monthly_fee, currency)')
      .eq('user_id', user.id)
      .eq('status', 'approved')

    if (memberships?.length) {
      for (const m of memberships) {
        const club = Array.isArray(m.clubs) ? m.clubs[0] : m.clubs
        if (!club) continue

        const feeType: string = club.fee_type ?? 'annual'
        const feeAmount: number =
          feeType === 'monthly' ? (club.monthly_fee ?? 0) : (club.annual_fee ?? 0)
        if (!feeAmount) continue

        // Check existing fee payment
        let query = supabase
          .from('finance_transactions')
          .select('id')
          .eq('club_id', m.club_id)
          .eq('member_id', user.id)
          .eq('type', 'fee')

        if (feeType === 'monthly') {
          // Check current month payment
          const monthStart = `${todayYear}-${String(todayMonth).padStart(2, '0')}-01`
          const nextMonth = todayMonth === 12 ? 1 : todayMonth + 1
          const nextYear = todayMonth === 12 ? todayYear + 1 : todayYear
          const monthEnd = `${nextYear}-${String(nextMonth).padStart(2, '0')}-01`
          query = query.gte('transaction_date', monthStart).lt('transaction_date', monthEnd)
        } else {
          // Check current year payment
          const yearStart = `${todayYear}-01-01`
          const yearEnd = `${todayYear + 1}-01-01`
          query = query.gte('transaction_date', yearStart).lt('transaction_date', yearEnd)
        }

        const { data: payments } = await query.maybeSingle()
        if (payments) continue // Already paid

        unpaidFees.push({
          clubId: m.club_id,
          clubName: club.name,
          feeType,
          amount: feeAmount,
          currency: club.currency ?? 'KRW',
        })
      }
    }
  } catch (_e) {
    // Graceful fallback
  }

  return NextResponse.json({ meeting: meetingResult, unpaidFees })
}
