-- Migration v2: RSVP & grouping for regular meetings
-- Run in Supabase SQL Editor

-- 1. RSVP 참석 여부
CREATE TABLE IF NOT EXISTS meeting_attendances (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  club_id      uuid REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  year         int NOT NULL,
  month        int NOT NULL,
  user_id      uuid REFERENCES users(id) NOT NULL,
  status       text NOT NULL CHECK (status IN ('attending', 'absent')),
  responded_at timestamptz DEFAULT now(),
  UNIQUE(club_id, year, month, user_id)
);

-- 2. 조 편성 헤더
CREATE TABLE IF NOT EXISTS meeting_groups (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  club_id      uuid REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  year         int NOT NULL,
  month        int NOT NULL,
  group_number int NOT NULL,
  tee_time     text,
  created_at   timestamptz DEFAULT now(),
  UNIQUE(club_id, year, month, group_number)
);

-- 3. 조 편성 멤버
CREATE TABLE IF NOT EXISTS meeting_group_members (
  id       uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  group_id uuid REFERENCES meeting_groups(id) ON DELETE CASCADE NOT NULL,
  user_id  uuid REFERENCES users(id) NOT NULL,
  UNIQUE(group_id, user_id)
);

-- ── RLS ──────────────────────────────────────────────────────────────────

ALTER TABLE meeting_attendances   ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_groups        ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_group_members ENABLE ROW LEVEL SECURITY;

-- meeting_attendances: 클럽 멤버 조회, 본인만 수정
CREATE POLICY "att_select"  ON meeting_attendances FOR SELECT
  USING (EXISTS (SELECT 1 FROM club_memberships WHERE club_id = meeting_attendances.club_id AND user_id = auth.uid() AND status = 'approved'));
CREATE POLICY "att_insert"  ON meeting_attendances FOR INSERT
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "att_update"  ON meeting_attendances FOR UPDATE
  USING (user_id = auth.uid());
CREATE POLICY "att_delete"  ON meeting_attendances FOR DELETE
  USING (user_id = auth.uid());

-- meeting_groups: 클럽 멤버 조회, 회장·총무 수정
CREATE POLICY "grp_select"  ON meeting_groups FOR SELECT
  USING (EXISTS (SELECT 1 FROM club_memberships WHERE club_id = meeting_groups.club_id AND user_id = auth.uid() AND status = 'approved'));
CREATE POLICY "grp_insert"  ON meeting_groups FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM club_memberships WHERE club_id = meeting_groups.club_id AND user_id = auth.uid() AND role IN ('president','secretary') AND status = 'approved'));
CREATE POLICY "grp_update"  ON meeting_groups FOR UPDATE
  USING (EXISTS (SELECT 1 FROM club_memberships WHERE club_id = meeting_groups.club_id AND user_id = auth.uid() AND role IN ('president','secretary') AND status = 'approved'));
CREATE POLICY "grp_delete"  ON meeting_groups FOR DELETE
  USING (EXISTS (SELECT 1 FROM club_memberships WHERE club_id = meeting_groups.club_id AND user_id = auth.uid() AND role IN ('president','secretary') AND status = 'approved'));

-- meeting_group_members: 조회는 멤버, 수정은 회장·총무
CREATE POLICY "grpm_select" ON meeting_group_members FOR SELECT
  USING (EXISTS (SELECT 1 FROM meeting_groups g JOIN club_memberships cm ON cm.club_id = g.club_id WHERE g.id = meeting_group_members.group_id AND cm.user_id = auth.uid() AND cm.status = 'approved'));
CREATE POLICY "grpm_insert" ON meeting_group_members FOR INSERT
  WITH CHECK (EXISTS (SELECT 1 FROM meeting_groups g JOIN club_memberships cm ON cm.club_id = g.club_id WHERE g.id = meeting_group_members.group_id AND cm.user_id = auth.uid() AND cm.role IN ('president','secretary') AND cm.status = 'approved'));
CREATE POLICY "grpm_delete" ON meeting_group_members FOR DELETE
  USING (EXISTS (SELECT 1 FROM meeting_groups g JOIN club_memberships cm ON cm.club_id = g.club_id WHERE g.id = meeting_group_members.group_id AND cm.user_id = auth.uid() AND cm.role IN ('president','secretary') AND cm.status = 'approved'));
