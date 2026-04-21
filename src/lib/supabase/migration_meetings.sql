-- Migration: Regular meeting schedule with monthly overrides
-- Run this in Supabase SQL Editor

-- 1. Recurring meeting pattern (one per club)
CREATE TABLE IF NOT EXISTS recurring_meetings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE NOT NULL UNIQUE,
  week_of_month int NOT NULL CHECK (week_of_month BETWEEN 1 AND 5),
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 1=Mon, ..., 6=Sat
  start_time time NOT NULL DEFAULT '07:00',
  venue text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  updated_at timestamptz DEFAULT now()
);

-- 2. Monthly overrides (cancel or reschedule a specific month)
CREATE TABLE IF NOT EXISTS meeting_overrides (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'rescheduled'
    CHECK (status IN ('cancelled', 'rescheduled')),
  override_date date,          -- new date if rescheduled
  override_time time,          -- new time if changed (null = same as pattern)
  reason text,                 -- e.g. '설날', '폭설'
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(club_id, year, month)
);

-- 3. RLS 활성화
ALTER TABLE recurring_meetings ENABLE ROW LEVEL SECURITY;
ALTER TABLE meeting_overrides  ENABLE ROW LEVEL SECURITY;

-- 4. recurring_meetings RLS 정책
--    조회: 해당 클럽 멤버라면 누구나
CREATE POLICY "recurring_meetings_select"
  ON recurring_meetings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = recurring_meetings.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.status  = 'approved'
    )
  );

--    수정/삽입: 회장·총무만
CREATE POLICY "recurring_meetings_insert"
  ON recurring_meetings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = recurring_meetings.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.role    IN ('president', 'secretary')
        AND club_memberships.status  = 'approved'
    )
  );

CREATE POLICY "recurring_meetings_update"
  ON recurring_meetings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = recurring_meetings.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.role    IN ('president', 'secretary')
        AND club_memberships.status  = 'approved'
    )
  );

-- 5. meeting_overrides RLS 정책
CREATE POLICY "meeting_overrides_select"
  ON meeting_overrides FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = meeting_overrides.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.status  = 'approved'
    )
  );

CREATE POLICY "meeting_overrides_insert"
  ON meeting_overrides FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = meeting_overrides.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.role    IN ('president', 'secretary')
        AND club_memberships.status  = 'approved'
    )
  );

CREATE POLICY "meeting_overrides_update"
  ON meeting_overrides FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = meeting_overrides.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.role    IN ('president', 'secretary')
        AND club_memberships.status  = 'approved'
    )
  );

CREATE POLICY "meeting_overrides_delete"
  ON meeting_overrides FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = meeting_overrides.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.role    IN ('president', 'secretary')
        AND club_memberships.status  = 'approved'
    )
  );
