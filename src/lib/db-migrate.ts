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
