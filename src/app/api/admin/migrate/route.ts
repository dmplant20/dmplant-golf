import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// ── 마이그레이션 목록 ────────────────────────────────────────────────────
// checkTable/checkColumn: 해당 컬럼이 있으면 이미 적용된 것으로 판단
const MIGRATIONS = [
  {
    name:        'add_yardage',
    label:       '야디지(Yardage) 컬럼',
    checkTable:  'personal_round_holes',
    checkColumn: 'yardage',
    // 이 SQL은 app_run_migration 함수도 생성 (최초 1회)
    setupSql: `-- Supabase SQL Editor에서 실행하세요 (최초 1회)
ALTER TABLE personal_round_holes
  ADD COLUMN IF NOT EXISTS yardage int CHECK (yardage BETWEEN 50 AND 1000);

-- 아래는 앱에서 마이그레이션 실행을 가능하게 하는 함수입니다
CREATE OR REPLACE FUNCTION public.app_run_migration(migration_name text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE is_admin boolean;
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
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_name='personal_round_holes' AND column_name='yardage') THEN
      EXECUTE 'ALTER TABLE personal_round_holes ADD COLUMN yardage int CHECK (yardage BETWEEN 50 AND 1000)';
      RETURN jsonb_build_object('ok', true, 'status', 'applied');
    ELSE
      RETURN jsonb_build_object('ok', true, 'status', 'already_applied');
    END IF;
  END IF;

  IF migration_name = 'add_golf_course_fees' THEN
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_name='golf_courses' AND column_name='green_fee_weekday_vnd') THEN
      EXECUTE 'ALTER TABLE golf_courses ADD COLUMN green_fee_weekday_vnd bigint';
      EXECUTE 'ALTER TABLE golf_courses ADD COLUMN green_fee_weekend_vnd bigint';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_name='golf_courses' AND column_name='sub_courses') THEN
      EXECUTE 'ALTER TABLE golf_courses ADD COLUMN sub_courses text';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_name='golf_courses' AND column_name='distance_km') THEN
      EXECUTE 'ALTER TABLE golf_courses ADD COLUMN distance_km integer';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_name='golf_courses' AND column_name='district') THEN
      EXECUTE 'ALTER TABLE golf_courses ADD COLUMN district text';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM information_schema.columns
      WHERE table_name='golf_courses' AND column_name='club_id') THEN
      EXECUTE 'ALTER TABLE golf_courses ADD COLUMN club_id uuid';
    END IF;
    RETURN jsonb_build_object('ok', true, 'status', 'applied');
  END IF;

  RETURN jsonb_build_object('ok', false, 'message', 'unknown migration');
END; $$;
GRANT EXECUTE ON FUNCTION public.app_run_migration(text) TO authenticated;`,
  },
  {
    name:        'add_golf_course_fees',
    label:       '골프장 그린피/서브코스/거리 컬럼',
    checkTable:  'golf_courses',
    checkColumn: 'green_fee_weekday_vnd',
    setupSql: `-- Supabase SQL Editor에서 실행하세요
ALTER TABLE golf_courses
  ADD COLUMN IF NOT EXISTS green_fee_weekday_vnd bigint,
  ADD COLUMN IF NOT EXISTS green_fee_weekend_vnd bigint,
  ADD COLUMN IF NOT EXISTS sub_courses text,
  ADD COLUMN IF NOT EXISTS distance_km integer,
  ADD COLUMN IF NOT EXISTS district text,
  ADD COLUMN IF NOT EXISTS club_id uuid;`,
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
      const { error } = await supabase
        .from(m.checkTable)
        .select(m.checkColumn)
        .limit(1)

      const applied = !error

      return {
        name:     m.name,
        label:    m.label,
        applied,
        setupSql: applied ? null : m.setupSql,
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

  const m = MIGRATIONS.find(x => x.name === migration)

  // app_run_migration RPC 함수 호출
  const { data, error } = await supabase.rpc('app_run_migration', { migration_name: migration })

  if (error || (data && !data.ok && data.message === 'unknown migration')) {
    // 함수가 없거나 해당 migration_name을 모르는 경우 → setupSql 안내
    return NextResponse.json({
      ok: false,
      needsSetup: true,
      setupSql: m?.setupSql ?? '',
      message: 'Supabase SQL Editor에서 아래 SQL을 실행해주세요.',
    })
  }

  return NextResponse.json(data)
}
