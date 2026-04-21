-- Migration: Round scores & handicap tracking
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS round_scores (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  club_id      uuid REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  user_id      uuid REFERENCES users(id) NOT NULL,
  year         int NOT NULL,
  month        int NOT NULL,
  gross_score  int NOT NULL CHECK (gross_score > 0),
  handicap_used int,          -- 당일 사용한 클럽 핸디
  net_score    int,            -- gross - handicap (앱에서 계산 후 저장)
  course_name  text,           -- 플레이한 골프장 이름
  course_par   int DEFAULT 72, -- 코스 파 (기본 72)
  notes        text,
  recorded_by  uuid REFERENCES users(id),
  played_at    date,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(club_id, user_id, year, month)   -- 월 1회 원례회 기준
);

ALTER TABLE round_scores ENABLE ROW LEVEL SECURITY;

-- 클럽 멤버 전체 조회 가능
CREATE POLICY "scores_select" ON round_scores FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = round_scores.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.status  = 'approved'
    )
  );

-- 본인 또는 회장·총무가 입력/수정/삭제 가능
CREATE POLICY "scores_insert" ON round_scores FOR INSERT
  WITH CHECK (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = round_scores.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.role    IN ('president', 'secretary')
        AND club_memberships.status  = 'approved'
    )
  );

CREATE POLICY "scores_update" ON round_scores FOR UPDATE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = round_scores.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.role    IN ('president', 'secretary')
        AND club_memberships.status  = 'approved'
    )
  );

CREATE POLICY "scores_delete" ON round_scores FOR DELETE
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = round_scores.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.role    IN ('president', 'secretary')
        AND club_memberships.status  = 'approved'
    )
  );
