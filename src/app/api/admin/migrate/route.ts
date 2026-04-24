import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ── 마이그레이션 목록 ────────────────────────────────────────────────────
// 각 마이그레이션은 { name, label, checkSql } 형태로 정의
// checkSql: 해당 컬럼/테이블이 존재하는지 확인하는 SELECT (1개 row 반환 시 이미 적용됨)
const MIGRATIONS = [
  {
    name:     'add_yardage',
    label:    '야디지(Yardage) 컬럼',
    table:    'personal_round_holes',
    column:   'yardage',
    setupSql: `-- 아래 SQL을 Supabase SQL Editor에서 한 번만 실행하세요
-- https://supabase.com/dashboard/project/ndalczzqwdaszxokuxvh/sql/new

ALTER TABLE personal_round_holes
  ADD COLUMN IF NOT EXISTS yardage int CHECK (yardage BETWEEN 50 AND 1000);

CREATE OR REPLACE FUNCTION public.app_run_migration(migration_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM club_memberships
    WHERE user_id = auth.uid()
      AND role IN ('president', 'secretary')
      AND status = 'approved'
  ) INTO is_admin;
  IF NOT is_admin THEN
    RETURN jsonb_build_object('ok', false, 'message', '권한 없음');
  END IF;
  IF migration_name = 'add_yardage' THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'personal_round_holes' AND column_name = 'yardage'
    ) THEN
      EXECUTE 'ALTER TABLE personal_round_holes ADD COLUMN yardage int CHECK (yardage BETWEEN 50 AND 1000)';
      RETURN jsonb_build_object('ok', true, 'status', 'applied');
    ELSE
      RETURN jsonb_build_object('ok', true, 'status', 'already_applied');
    END IF;
  END IF;
  RETURN jsonb_build_object('ok', false, 'message', 'unknown migration');
END;
$$;
GRANT EXECUTE ON FUNCTION public.app_run_migration(text) TO authenticated;`,
  },
]

async function makeSupabase() {
  const cookieStore = await cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll:  () => cookieStore.getAll(),
        setAll: (list) => list.forEach(({ name, value, options }) => cookieStore.set(name, value, options)),
      },
    }
  )
}

// ── GET: 마이그레이션 상태 조회 ──────────────────────────────────────────
export async function GET() {
  const supabase = await makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const statuses = await Promise.all(
    MIGRATIONS.map(async (m) => {
      // 컬럼 존재 여부: personal_round_holes에서 dummy 쿼리로 확인
      const { error } = await supabase
        .from(m.table)
        .select(m.column)
        .limit(1)

      const applied = !error  // 에러 없으면 컬럼 존재
      const needsSetup = error?.message?.includes('function') || false

      return {
        name:      m.name,
        label:     m.label,
        applied,
        setupSql:  applied ? null : m.setupSql,
      }
    })
  )

  return NextResponse.json({ migrations: statuses })
}

// ── POST: 마이그레이션 실행 ──────────────────────────────────────────────
export async function POST(req: NextRequest) {
  const supabase = await makeSupabase()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { migration } = await req.json()
  if (!migration) return NextResponse.json({ error: 'migration name required' }, { status: 400 })

  // app_run_migration RPC 함수 호출
  const { data, error } = await supabase.rpc('app_run_migration', { migration_name: migration })

  if (error) {
    // 함수가 아직 DB에 없는 경우
    const m = MIGRATIONS.find(x => x.name === migration)
    return NextResponse.json({
      ok: false,
      needsSetup: true,
      setupSql: m?.setupSql ?? '',
      message: 'app_run_migration 함수가 아직 DB에 등록되지 않았습니다. 아래 SQL을 Supabase SQL Editor에서 실행해주세요.',
    })
  }

  return NextResponse.json(data)
}
