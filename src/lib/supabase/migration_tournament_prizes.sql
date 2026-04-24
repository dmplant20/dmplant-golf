-- Migration: Tournament prizes + event_type + role expansion
-- Run in Supabase SQL Editor (after schema.sql and all other migrations)

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. tournaments — event_type 컬럼 추가
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE tournaments
  ADD COLUMN IF NOT EXISTS event_type text NOT NULL DEFAULT 'special'
    CHECK (event_type IN ('first_half', 'second_half', 'year_end', 'special'));

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. tournaments RLS (schema.sql에 누락)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE tournaments ENABLE ROW LEVEL SECURITY;

-- 클럽 멤버는 조회 가능
CREATE POLICY "tournaments_select" ON tournaments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = tournaments.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.status  = 'approved'
    )
  );

-- 임원진(회장·부회장·총무·감사·고문·임원)만 생성/수정/삭제
CREATE POLICY "tournaments_insert" ON tournaments FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = tournaments.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.role    IN ('president','vice_president','secretary','auditor','advisor','officer')
        AND club_memberships.status  = 'approved'
    )
  );

CREATE POLICY "tournaments_update" ON tournaments FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = tournaments.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.role    IN ('president','vice_president','secretary','auditor','advisor','officer')
        AND club_memberships.status  = 'approved'
    )
  );

CREATE POLICY "tournaments_delete" ON tournaments FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = tournaments.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.role    IN ('president','vice_president','secretary')
        AND club_memberships.status  = 'approved'
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. tournament_prizes 테이블 생성
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS tournament_prizes (
  id                uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  tournament_id     uuid REFERENCES tournaments(id) ON DELETE CASCADE NOT NULL,
  prize_rank        int,   -- NULL = 순위 없는 상 (니어핀 등)
  prize_type        text NOT NULL DEFAULT 'place'
    CHECK (prize_type IN ('place','nearest_pin','longest_drive','best_gross','most_improved','special')),
  user_id           uuid REFERENCES users(id) ON DELETE SET NULL,
  member_name       text,             -- 비회원이거나 수동 입력 시
  gross_score       int,
  net_score         int,
  prize_description text,             -- 상품 설명 ("드라이버", "상품권 5만원" 등)
  created_by        uuid REFERENCES users(id),
  created_at        timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tournament_prizes_tournament_id ON tournament_prizes(tournament_id);

-- ── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE tournament_prizes ENABLE ROW LEVEL SECURITY;

-- 클럽 멤버 조회
CREATE POLICY "prizes_select" ON tournament_prizes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      JOIN club_memberships cm ON cm.club_id = t.club_id
      WHERE t.id = tournament_prizes.tournament_id
        AND cm.user_id = auth.uid()
        AND cm.status  = 'approved'
    )
  );

-- 임원진 입력/수정/삭제
CREATE POLICY "prizes_insert" ON tournament_prizes FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments t
      JOIN club_memberships cm ON cm.club_id = t.club_id
      WHERE t.id = tournament_prizes.tournament_id
        AND cm.user_id = auth.uid()
        AND cm.role    IN ('president','vice_president','secretary','auditor','advisor','officer')
        AND cm.status  = 'approved'
    )
  );

CREATE POLICY "prizes_update" ON tournament_prizes FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      JOIN club_memberships cm ON cm.club_id = t.club_id
      WHERE t.id = tournament_prizes.tournament_id
        AND cm.user_id = auth.uid()
        AND cm.role    IN ('president','vice_president','secretary','auditor','advisor','officer')
        AND cm.status  = 'approved'
    )
  );

CREATE POLICY "prizes_delete" ON tournament_prizes FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      JOIN club_memberships cm ON cm.club_id = t.club_id
      WHERE t.id = tournament_prizes.tournament_id
        AND cm.user_id = auth.uid()
        AND cm.role    IN ('president','vice_president','secretary','auditor','advisor','officer')
        AND cm.status  = 'approved'
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. tournament_groups / tournament_group_members RLS (schema.sql에 누락)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE tournament_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE tournament_group_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tgrp_select" ON tournament_groups FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      JOIN club_memberships cm ON cm.club_id = t.club_id
      WHERE t.id = tournament_groups.tournament_id
        AND cm.user_id = auth.uid() AND cm.status = 'approved'
    )
  );

CREATE POLICY "tgrp_insert" ON tournament_groups FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournaments t
      JOIN club_memberships cm ON cm.club_id = t.club_id
      WHERE t.id = tournament_groups.tournament_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('president','vice_president','secretary','auditor','advisor','officer')
        AND cm.status = 'approved'
    )
  );

CREATE POLICY "tgrp_delete" ON tournament_groups FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tournaments t
      JOIN club_memberships cm ON cm.club_id = t.club_id
      WHERE t.id = tournament_groups.tournament_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('president','vice_president','secretary')
        AND cm.status = 'approved'
    )
  );

CREATE POLICY "tgrpm_select" ON tournament_group_members FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM tournament_groups g
      JOIN tournaments t ON t.id = g.tournament_id
      JOIN club_memberships cm ON cm.club_id = t.club_id
      WHERE g.id = tournament_group_members.group_id
        AND cm.user_id = auth.uid() AND cm.status = 'approved'
    )
  );

CREATE POLICY "tgrpm_insert" ON tournament_group_members FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM tournament_groups g
      JOIN tournaments t ON t.id = g.tournament_id
      JOIN club_memberships cm ON cm.club_id = t.club_id
      WHERE g.id = tournament_group_members.group_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('president','vice_president','secretary','auditor','advisor','officer')
        AND cm.status = 'approved'
    )
  );

CREATE POLICY "tgrpm_update" ON tournament_group_members FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM tournament_groups g
      JOIN tournaments t ON t.id = g.tournament_id
      JOIN club_memberships cm ON cm.club_id = t.club_id
      WHERE g.id = tournament_group_members.group_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('president','vice_president','secretary','auditor','advisor','officer')
        AND cm.status = 'approved'
    )
  );

CREATE POLICY "tgrpm_delete" ON tournament_group_members FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM tournament_groups g
      JOIN tournaments t ON t.id = g.tournament_id
      JOIN club_memberships cm ON cm.club_id = t.club_id
      WHERE g.id = tournament_group_members.group_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('president','vice_president','secretary')
        AND cm.status = 'approved'
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. club_memberships — role CHECK 확장 (부회장·감사·고문 추가)
-- ══════════════════════════════════════════════════════════════════════════════
-- 기존 제약 삭제 후 새 제약 추가 (제약 이름 확인 필요)
ALTER TABLE club_memberships
  DROP CONSTRAINT IF EXISTS club_memberships_role_check;

ALTER TABLE club_memberships
  ADD CONSTRAINT club_memberships_role_check
    CHECK (role IN ('president','vice_president','secretary','auditor','advisor','officer','member'));

-- ══════════════════════════════════════════════════════════════════════════════
-- 6. announcements RLS (schema.sql에 누락)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE announcements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ann_select" ON announcements FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = announcements.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.status  = 'approved'
    )
  );

CREATE POLICY "ann_insert" ON announcements FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = announcements.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.role    IN ('president','vice_president','secretary','auditor','advisor','officer')
        AND club_memberships.status  = 'approved'
    )
  );

CREATE POLICY "ann_update" ON announcements FOR UPDATE
  USING (author_id = auth.uid());

CREATE POLICY "ann_delete" ON announcements FOR DELETE
  USING (
    author_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = announcements.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.role    IN ('president','secretary')
        AND club_memberships.status  = 'approved'
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 7. events RLS + type 확장 (schema.sql에 누락)
-- ══════════════════════════════════════════════════════════════════════════════

-- type 제약 확장 (meeting 추가 — 정기 모임 공지 용도)
ALTER TABLE events
  DROP CONSTRAINT IF EXISTS events_type_check;

ALTER TABLE events
  ADD CONSTRAINT events_type_check
    CHECK (type IN ('meeting', 'tournament', 'celebration', 'condolence', 'other'));

ALTER TABLE events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "events_select" ON events FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = events.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.status  = 'approved'
    )
  );

CREATE POLICY "events_insert" ON events FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = events.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.role    IN ('president','vice_president','secretary','auditor','advisor','officer')
        AND club_memberships.status  = 'approved'
    )
  );

CREATE POLICY "events_update" ON events FOR UPDATE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = events.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.role    IN ('president','secretary')
        AND club_memberships.status  = 'approved'
    )
  );

CREATE POLICY "events_delete" ON events FOR DELETE
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = events.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.role    IN ('president','secretary')
        AND club_memberships.status  = 'approved'
    )
  );
