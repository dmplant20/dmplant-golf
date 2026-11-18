-- Migration: 2차 모임 (after-party) + push subscription RLS
-- Run in Supabase SQL Editor

-- ══════════════════════════════════════════════════════════════════════════════
-- 1. second_meetings 테이블 — 월별 2차 모임 (레스토랑/장소)
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS second_meetings (
  id                  uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  club_id             uuid REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  year                int  NOT NULL,
  month               int  NOT NULL CHECK (month BETWEEN 1 AND 12),
  restaurant_name     text NOT NULL,
  restaurant_address  text,
  google_place_id     text,              -- Google Places place_id (검색 결과에서 자동 입력)
  lat                 numeric(10,7),     -- 위도
  lng                 numeric(10,7),     -- 경도
  time                text,              -- '19:00' 형식
  notes               text,
  confirmed_by        uuid REFERENCES users(id),
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now(),
  UNIQUE(club_id, year, month)
);

-- ══════════════════════════════════════════════════════════════════════════════
-- 2. second_meeting_attendances 테이블 — 2차 참석 여부
-- ══════════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS second_meeting_attendances (
  id                  uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  club_id             uuid REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  year                int  NOT NULL,
  month               int  NOT NULL CHECK (month BETWEEN 1 AND 12),
  second_meeting_id   uuid REFERENCES second_meetings(id) ON DELETE CASCADE NOT NULL,
  user_id             uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  status              text NOT NULL CHECK (status IN ('attending', 'absent')),
  responded_at        timestamptz DEFAULT now(),
  UNIQUE(second_meeting_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_second_meetings_club_year_month    ON second_meetings(club_id, year, month);
CREATE INDEX IF NOT EXISTS idx_sma_second_meeting_id              ON second_meeting_attendances(second_meeting_id);

-- ══════════════════════════════════════════════════════════════════════════════
-- 3. RLS — second_meetings
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE second_meetings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sm_select" ON second_meetings FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = second_meetings.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.status  = 'approved'
    )
  );

CREATE POLICY "sm_insert" ON second_meetings FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = second_meetings.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.role    IN ('president','vice_president','secretary','auditor','advisor','officer')
        AND club_memberships.status  = 'approved'
    )
  );

CREATE POLICY "sm_update" ON second_meetings FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = second_meetings.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.role    IN ('president','vice_president','secretary','auditor','advisor','officer')
        AND club_memberships.status  = 'approved'
    )
  );

CREATE POLICY "sm_delete" ON second_meetings FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = second_meetings.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.role    IN ('president','vice_president','secretary')
        AND club_memberships.status  = 'approved'
    )
  );

-- ══════════════════════════════════════════════════════════════════════════════
-- 4. RLS — second_meeting_attendances
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE second_meeting_attendances ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sma_select" ON second_meeting_attendances FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = second_meeting_attendances.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.status  = 'approved'
    )
  );

CREATE POLICY "sma_insert" ON second_meeting_attendances FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "sma_update" ON second_meeting_attendances FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "sma_delete" ON second_meeting_attendances FOR DELETE
  USING (user_id = auth.uid());

-- ══════════════════════════════════════════════════════════════════════════════
-- 5. push_subscriptions RLS (schema.sql에 누락)
-- ══════════════════════════════════════════════════════════════════════════════
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- 본인 구독 조회·추가·삭제만 허용
CREATE POLICY "push_select" ON push_subscriptions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "push_insert" ON push_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_delete" ON push_subscriptions FOR DELETE
  USING (user_id = auth.uid());

-- 서버(service_role)는 모든 구독 조회 가능 — 알림 발송 시 사용
-- (service_role 키는 RLS를 bypass하므로 별도 정책 불필요)
