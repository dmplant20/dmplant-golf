-- ════════════════════════════════════════════════════════════════════════════
-- 정기모임 Guest (게스트) 추천 시스템
-- ────────────────────────────────────────────────────────────────────────────
-- 사용법: Supabase SQL Editor → 새 쿼리 → 붙여넣기 → Run
-- ════════════════════════════════════════════════════════════════════════════

-- 1. meeting_guests — 회원이 추천한 게스트
CREATE TABLE IF NOT EXISTS meeting_guests (
  id              uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id         uuid REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  year            int  NOT NULL,
  month           int  NOT NULL,
  full_name       text NOT NULL,
  full_name_en    text,
  handicap        int,                                -- NULL 허용 (모를 때)
  notes           text,                               -- 메모 (예: 추천 이유)
  recommended_by  uuid REFERENCES users(id) ON DELETE SET NULL,
  approved        boolean DEFAULT false NOT NULL,
  approved_by     uuid REFERENCES users(id) ON DELETE SET NULL,
  approved_at     timestamptz,
  created_at      timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_meeting_guests_club_ym
  ON meeting_guests(club_id, year, month, approved);

-- 2. meeting_group_members 에 guest_id 컬럼 추가 (user_id 또는 guest_id 둘 중 하나)
ALTER TABLE meeting_group_members
  ADD COLUMN IF NOT EXISTS guest_id uuid REFERENCES meeting_guests(id) ON DELETE CASCADE;

-- 기존 NOT NULL 제약 해제 (guest 인 경우 user_id 가 NULL)
DO $$ BEGIN
  ALTER TABLE meeting_group_members ALTER COLUMN user_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- 둘 중 정확히 하나만 채워져야 함
DO $$ BEGIN
  ALTER TABLE meeting_group_members DROP CONSTRAINT IF EXISTS mgm_user_or_guest;
  ALTER TABLE meeting_group_members ADD CONSTRAINT mgm_user_or_guest CHECK (
    (user_id IS NOT NULL AND guest_id IS NULL)
    OR (user_id IS NULL AND guest_id IS NOT NULL)
  );
EXCEPTION WHEN others THEN NULL;
END $$;

-- 3. RLS — 회원은 본인 클럽의 게스트를 모두 조회 + 추천 가능
--          회장·총무는 승인·거절 가능, 추천자 본인이 거절도 가능
ALTER TABLE meeting_guests ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "guests_select" ON meeting_guests;
CREATE POLICY "guests_select" ON meeting_guests FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM club_memberships
    WHERE club_id = meeting_guests.club_id AND user_id = auth.uid() AND status = 'approved'
  ));

DROP POLICY IF EXISTS "guests_insert" ON meeting_guests;
CREATE POLICY "guests_insert" ON meeting_guests FOR INSERT TO authenticated
  WITH CHECK (
    recommended_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_id = meeting_guests.club_id AND user_id = auth.uid() AND status = 'approved'
    )
  );

-- 승인·수정: 추천 본인 OR 회장·총무
DROP POLICY IF EXISTS "guests_update" ON meeting_guests;
CREATE POLICY "guests_update" ON meeting_guests FOR UPDATE TO authenticated
  USING (
    recommended_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_id = meeting_guests.club_id AND user_id = auth.uid()
        AND role IN ('president','secretary') AND status = 'approved'
    )
  );

DROP POLICY IF EXISTS "guests_delete" ON meeting_guests;
CREATE POLICY "guests_delete" ON meeting_guests FOR DELETE TO authenticated
  USING (
    recommended_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_id = meeting_guests.club_id AND user_id = auth.uid()
        AND role IN ('president','secretary') AND status = 'approved'
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- ✅ 적용 후: 정기모임 페이지에서 "Guest 추천" 가능, 임원이 승인하면 조 편성 풀에 포함
-- ════════════════════════════════════════════════════════════════════════════
