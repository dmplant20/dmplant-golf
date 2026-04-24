/**
 * 서버 사이드 자동 마이그레이션
 * DATABASE_URL 환경변수가 있으면 pg로 직접 연결해서 누락된 컬럼을 자동으로 추가합니다.
 * 모든 ALTER TABLE은 IF NOT EXISTS 이므로 이미 존재하는 컬럼은 건드리지 않습니다.
 */

let migrated = false  // 프로세스당 1회만 실행

const MIGRATIONS = `
-- golf_courses 확장 컬럼
ALTER TABLE golf_courses ADD COLUMN IF NOT EXISTS green_fee_weekday_vnd bigint;
ALTER TABLE golf_courses ADD COLUMN IF NOT EXISTS green_fee_weekend_vnd bigint;
ALTER TABLE golf_courses ADD COLUMN IF NOT EXISTS sub_courses text;
ALTER TABLE golf_courses ADD COLUMN IF NOT EXISTS distance_km integer;
ALTER TABLE golf_courses ADD COLUMN IF NOT EXISTS district text;
ALTER TABLE golf_courses ADD COLUMN IF NOT EXISTS club_id uuid;
ALTER TABLE golf_courses ADD COLUMN IF NOT EXISTS phone text;
ALTER TABLE golf_courses ADD COLUMN IF NOT EXISTS website text;
ALTER TABLE golf_courses ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE golf_courses ADD COLUMN IF NOT EXISTS name_vn text;

-- personal_round_holes 야디지 컬럼
ALTER TABLE personal_round_holes ADD COLUMN IF NOT EXISTS yardage int
  CHECK (yardage IS NULL OR (yardage BETWEEN 50 AND 1000));

-- users 생년월일 컬럼
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date date;

-- 생일 알림 기록 테이블 (없으면 생성)
CREATE TABLE IF NOT EXISTS birthday_notifications (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  club_id     uuid REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  year        int  NOT NULL,
  type        text NOT NULL CHECK (type IN ('advance', 'today')),
  sent_at     timestamptz DEFAULT now() NOT NULL,
  UNIQUE(user_id, club_id, year, type)
);
CREATE INDEX IF NOT EXISTS idx_birthday_notifications_club_year
  ON birthday_notifications(club_id, year);

-- 정기모임 참석 응답 테이블
CREATE TABLE IF NOT EXISTS meeting_attendances (
  id          uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id     uuid REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  user_id     uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  year        int  NOT NULL,
  month       int  NOT NULL,
  status      text NOT NULL CHECK (status IN ('attending', 'not_attending')),
  reason      text,
  responded_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(club_id, user_id, year, month)
);
CREATE INDEX IF NOT EXISTS idx_meeting_attendances_club
  ON meeting_attendances(club_id, year, month);

-- club_memberships 역할 제약 조건 확장 (vice_president, auditor, advisor 포함)
DO $$ BEGIN
  ALTER TABLE club_memberships DROP CONSTRAINT IF EXISTS club_memberships_role_check;
  ALTER TABLE club_memberships ADD CONSTRAINT club_memberships_role_check
    CHECK (role IN ('president','vice_president','secretary','auditor','advisor','officer','member'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- 탈퇴 추적 컬럼
ALTER TABLE club_memberships ADD COLUMN IF NOT EXISTS withdrawn_at       timestamptz;
ALTER TABLE club_memberships ADD COLUMN IF NOT EXISTS withdrawn_by       uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE club_memberships ADD COLUMN IF NOT EXISTS withdrawal_reason  text;

-- 회원 활동 감사 로그 (한번 기록된 내용은 삭제 불가)
CREATE TABLE IF NOT EXISTS member_activity_log (
  id             uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id        uuid        REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  target_user_id uuid        REFERENCES users(id) ON DELETE SET NULL,
  actor_id       uuid        REFERENCES users(id) ON DELETE SET NULL,
  action         text        NOT NULL,
  old_value      text,
  new_value      text,
  note           text,
  created_at     timestamptz DEFAULT now() NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_member_activity_log_club_time
  ON member_activity_log(club_id, created_at DESC);

-- RLS
ALTER TABLE member_activity_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mal_select" ON member_activity_log;
CREATE POLICY "mal_select" ON member_activity_log FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM club_memberships
    WHERE club_id = member_activity_log.club_id
      AND user_id = auth.uid() AND status = 'approved'
  ));
DROP POLICY IF EXISTS "mal_insert" ON member_activity_log;
CREATE POLICY "mal_insert" ON member_activity_log FOR INSERT
  WITH CHECK (actor_id = auth.uid());
`

export async function autoMigrate(): Promise<void> {
  if (migrated) return

  const url = process.env.DATABASE_URL
  if (!url) return  // DATABASE_URL 없으면 조용히 스킵

  try {
    // 동적 import — 서버 사이드에서만 실행됨
    const { Client } = await import('pg')
    const client = new Client({ connectionString: url, ssl: { rejectUnauthorized: false } })
    await client.connect()
    await client.query(MIGRATIONS)
    await client.end()
    migrated = true
    console.log('[auto-migrate] ✓ DB schema up-to-date')
  } catch (err) {
    // 마이그레이션 실패해도 앱은 계속 동작 (auto-retry로 fallback)
    console.warn('[auto-migrate] skipped:', (err as Error).message?.slice(0, 120))
  }
}
