-- ────────────────────────────────────────────────────────────────────────────
-- 생일 알림 시스템 마이그레이션
-- Supabase SQL Editor에서 실행하세요
-- ────────────────────────────────────────────────────────────────────────────

-- 1. users 테이블에 생년월일 컬럼 추가
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;

-- 2. 생일 알림 발송 기록 테이블 (중복 발송 방지)
CREATE TABLE IF NOT EXISTS birthday_notifications (
  id          UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  club_id     UUID REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  year        INT  NOT NULL,
  type        TEXT NOT NULL CHECK (type IN ('advance', 'today')),
  sent_at     TIMESTAMPTZ DEFAULT now() NOT NULL,
  UNIQUE(user_id, club_id, year, type)
);

CREATE INDEX IF NOT EXISTS idx_birthday_notifications_club_year
  ON birthday_notifications(club_id, year);

-- 3. RLS 정책 (서비스 롤만 접근)
ALTER TABLE birthday_notifications ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자는 자신의 기록만 읽기 가능
CREATE POLICY "own_birthday_notifications" ON birthday_notifications
  FOR SELECT USING (auth.uid() = user_id);
