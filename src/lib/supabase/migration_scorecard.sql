-- Migration: Personal scorecard (개인 스코어카드)
-- Run in Supabase SQL Editor

-- 라운드 헤더
CREATE TABLE IF NOT EXISTS personal_rounds (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id      uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  course_id    uuid REFERENCES golf_courses(id) ON DELETE SET NULL,
  course_name  text NOT NULL,
  course_par   int  NOT NULL DEFAULT 72,
  total_holes  int  NOT NULL DEFAULT 18 CHECK (total_holes IN (9, 18)),
  played_at    date NOT NULL,
  total_score  int,   -- 저장 시 계산
  notes        text,
  created_at   timestamptz DEFAULT now()
);

-- 홀별 스코어
CREATE TABLE IF NOT EXISTS personal_round_holes (
  id          uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  round_id    uuid REFERENCES personal_rounds(id) ON DELETE CASCADE NOT NULL,
  hole_number int  NOT NULL CHECK (hole_number BETWEEN 1 AND 18),
  par         int  NOT NULL DEFAULT 4 CHECK (par IN (3,4,5)),
  score       int  CHECK (score BETWEEN 1 AND 15),
  putts       int  CHECK (putts BETWEEN 0 AND 10),
  fairway_hit boolean,  -- par3은 NULL
  gir         boolean,  -- green in regulation
  UNIQUE(round_id, hole_number)
);

-- ── RLS: 본인만 접근 ──────────────────────────────────────────────────────

ALTER TABLE personal_rounds     ENABLE ROW LEVEL SECURITY;
ALTER TABLE personal_round_holes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "pr_select" ON personal_rounds FOR SELECT USING (user_id = auth.uid());
CREATE POLICY "pr_insert" ON personal_rounds FOR INSERT WITH CHECK (user_id = auth.uid());
CREATE POLICY "pr_update" ON personal_rounds FOR UPDATE USING (user_id = auth.uid());
CREATE POLICY "pr_delete" ON personal_rounds FOR DELETE USING (user_id = auth.uid());

CREATE POLICY "prh_select" ON personal_round_holes FOR SELECT
  USING (EXISTS (SELECT 1 FROM personal_rounds WHERE id = round_id AND user_id = auth.uid()));
CREATE POLICY "prh_insert" ON personal_round_holes FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM personal_rounds WHERE id = round_id AND user_id = auth.uid()));
CREATE POLICY "prh_update" ON personal_round_holes FOR UPDATE
  USING (EXISTS (SELECT 1 FROM personal_rounds WHERE id = round_id AND user_id = auth.uid()));
CREATE POLICY "prh_delete" ON personal_round_holes FOR DELETE
  USING (EXISTS (SELECT 1 FROM personal_rounds WHERE id = round_id AND user_id = auth.uid()));
