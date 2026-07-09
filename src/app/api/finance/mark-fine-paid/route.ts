import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { createClient as createServiceClient } from '@supabase/supabase-js'
import { cookies } from 'next/headers'
import { isSuperAdmin } from '@/lib/superAdmin'

// 벌금 수납 확인 — description 의 '[미납]' prefix 제거 + transaction_date 오늘로.
//
// 권한 체계 — 회장님 명시 요구사항:
//   super_admin (개발자) | president (회장) | secretary (총무)
//
// RLS 우회 — service_role 로 서버측 UPDATE
// (DB RLS 는 super_admin email 을 모르고, 회장 write 를 막을 수도 있어 서버에서 권한 체크 후 service_role 사용)

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
  const { id } = body as { id: string }
  if (!id) return NextResponse.json({ error: '필수값 누락 (id)' }, { status: 400 })

  const db = getDb()
  const admin = isSuperAdmin(user)

  // 대상 벌금 조회 — club_id 로 권한 검증
  const { data: fine, error: fErr } = await db.from('finance_transactions')
    .select('id, club_id, type, description').eq('id', id).maybeSingle()
  if (fErr) return NextResponse.json({ error: fErr.message }, { status: 500 })
  if (!fine) return NextResponse.json({ error: '벌금 내역을 찾을 수 없습니다' }, { status: 404 })
  if (fine.type !== 'fine') return NextResponse.json({ error: '벌금 거래가 아닙니다' }, { status: 400 })

  // 권한 체크 — admin 외에는 해당 클럽의 회장/총무여야 함
  if (!admin) {
    const { data: mem } = await db.from('club_memberships')
      .select('role').eq('club_id', fine.club_id).eq('user_id', user.id).eq('status', 'approved').maybeSingle()
    const role = (mem as any)?.role
    if (!mem || !['president', 'secretary'].includes(role)) {
      return NextResponse.json({ error: '회장·총무·개발자만 수납 확인할 수 있습니다' }, { status: 403 })
    }
  }

  const desc = String(fine.description ?? '')

  // 중복 방지 — 이미 다른 임원이 수납 확인했으면 ('[미납]' prefix 없음) no-op.
  // 두 임원이 동시에 눌러도 결과는 단 하나 (멱등). 에러가 아니라 already 로 안내 후 목록에서 제거.
  if (!desc.startsWith('[미납]')) {
    return NextResponse.json({ ok: true, already: true })
  }

  // '[미납]' prefix 제거 + 날짜 오늘로 → 잔고 합산 + 미납 팝업에서 사라짐
  // WHERE 에 prefix 조건을 걸어 동시 요청 중 하나만 실제 UPDATE 되도록 보장
  const newDesc = desc.replace(/^\[미납\]\s*/, '')
  const today = new Date().toISOString().split('T')[0]
  const { data: updated, error: upErr } = await db.from('finance_transactions')
    .update({ description: newDesc, transaction_date: today })
    .eq('id', id)
    .like('description', '[미납]%')
    .select('id')
  if (upErr) return NextResponse.json({ error: upErr.message }, { status: 500 })

  // 내가 UPDATE 하기 직전 다른 요청이 먼저 처리한 경우 — 0 rows. 역시 already 로 안내.
  const already = !updated || updated.length === 0
  return NextResponse.json({ ok: true, already })
}
