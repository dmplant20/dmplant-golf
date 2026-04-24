-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Personal round holes – yardage column
-- Run in Supabase SQL Editor (Settings → SQL Editor → New query)
-- ═══════════════════════════════════════════════════════════════════════

-- 1. 야디지 컬럼 추가
ALTER TABLE personal_round_holes
  ADD COLUMN IF NOT EXISTS yardage int CHECK (yardage BETWEEN 50 AND 1000);

-- ═══════════════════════════════════════════════════════════════════════
-- 2. 앱 내 마이그레이션 실행을 위한 함수 등록
--    이 함수를 한 번만 등록하면, 이후 마이그레이션은 앱 UI에서 가능합니다.
-- ═══════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.app_run_migration(migration_name text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  is_admin boolean;
  result   jsonb;
BEGIN
  -- 호출자가 클럽 회장 또는 총무인지 확인
  SELECT EXISTS (
    SELECT 1 FROM club_memberships
    WHERE user_id = auth.uid()
      AND role IN ('president', 'secretary')
      AND status = 'approved'
  ) INTO is_admin;

  IF NOT is_admin THEN
    RETURN jsonb_build_object('ok', false, 'message', '권한이 없습니다 (회장/총무만 가능)');
  END IF;

  -- ── 마이그레이션 목록 ─────────────────────────────────────────────
  IF migration_name = 'add_yardage' THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = 'personal_round_holes' AND column_name = 'yardage'
    ) THEN
      EXECUTE 'ALTER TABLE personal_round_holes ADD COLUMN yardage int CHECK (yardage BETWEEN 50 AND 1000)';
      RETURN jsonb_build_object('ok', true, 'status', 'applied', 'message', '야디지 컬럼이 추가되었습니다');
    ELSE
      RETURN jsonb_build_object('ok', true, 'status', 'already_applied', 'message', '이미 적용되어 있습니다');
    END IF;
  END IF;

  RETURN jsonb_build_object('ok', false, 'message', '알 수 없는 마이그레이션: ' || migration_name);
END;
$$;

-- 인증된 사용자 (앱 로그인) 에게 실행 권한 부여
GRANT EXECUTE ON FUNCTION public.app_run_migration(text) TO authenticated;
