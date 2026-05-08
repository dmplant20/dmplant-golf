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
  status      text NOT NULL CHECK (status IN ('attending', 'absent')),
  reason      text,
  responded_at timestamptz DEFAULT now() NOT NULL,
  UNIQUE(club_id, user_id, year, month)
);
CREATE INDEX IF NOT EXISTS idx_meeting_attendances_club
  ON meeting_attendances(club_id, year, month);

-- 기존 테이블의 status 제약 수정 (not_attending → absent)
DO $$ BEGIN
  ALTER TABLE meeting_attendances DROP CONSTRAINT IF EXISTS meeting_attendances_status_check;
  ALTER TABLE meeting_attendances ADD CONSTRAINT meeting_attendances_status_check
    CHECK (status IN ('attending', 'absent'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- meeting_attendances RLS
ALTER TABLE meeting_attendances ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "ma_select" ON meeting_attendances;
CREATE POLICY "ma_select" ON meeting_attendances FOR SELECT
  USING (EXISTS (
    SELECT 1 FROM club_memberships
    WHERE club_id = meeting_attendances.club_id
      AND user_id = auth.uid() AND status = 'approved'
  ));
DROP POLICY IF EXISTS "ma_upsert" ON meeting_attendances;
CREATE POLICY "ma_upsert" ON meeting_attendances FOR INSERT
  WITH CHECK (user_id = auth.uid());
DROP POLICY IF EXISTS "ma_update" ON meeting_attendances;
CREATE POLICY "ma_update" ON meeting_attendances FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

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

-- ────────────────────────────────────────────────────────────────────────────
-- announcements: 장소 추가 (모임/식사/행사 등 후 회원이 길찾기 가능)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS location_name text;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS location_url text;

-- ────────────────────────────────────────────────────────────────────────────
-- announcements: 정기모임 우선순위 + 자동 만료
--   is_meeting=true → 목록 1순위
--   expires_at 지나면 목록에서 자동 숨김 (실제 row 는 유지 — 감사 추적 목적)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS is_meeting boolean DEFAULT false NOT NULL;
ALTER TABLE announcements ADD COLUMN IF NOT EXISTS expires_at timestamptz;
CREATE INDEX IF NOT EXISTS idx_announcements_club_pinned_recent
  ON announcements(club_id, is_meeting DESC, created_at DESC);

-- ────────────────────────────────────────────────────────────────────────────
-- finance_transactions: 지출 분류 + 물품명 (경조사·상품·화환 등)
-- ────────────────────────────────────────────────────────────────────────────
ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS expense_category text;
ALTER TABLE finance_transactions ADD COLUMN IF NOT EXISTS item_name text;

DO $$ BEGIN
  ALTER TABLE finance_transactions DROP CONSTRAINT IF EXISTS finance_transactions_expense_category_check;
  ALTER TABLE finance_transactions ADD CONSTRAINT finance_transactions_expense_category_check
    CHECK (expense_category IS NULL OR expense_category IN ('condolence','gift','event','admin','other'));
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_finance_transactions_expense_category
  ON finance_transactions(club_id, expense_category)
  WHERE expense_category IS NOT NULL;

-- ────────────────────────────────────────────────────────────────────────────
-- chat: 1:1 DM + 그룹 채팅 (club_wide 외 추가 룸 타입)
-- ────────────────────────────────────────────────────────────────────────────

-- type 체크 확장: dm 추가
DO $$ BEGIN
  ALTER TABLE chat_rooms DROP CONSTRAINT IF EXISTS chat_rooms_type_check;
  ALTER TABLE chat_rooms ADD CONSTRAINT chat_rooms_type_check
    CHECK (type IN ('club_wide','group','tournament_group','dm'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- 룸 메타: 작성자 + 마지막 메시지 캐시 (목록 정렬·미리보기용)
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS last_message_at timestamptz;
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS last_message_preview text;

-- chat_messages: 첨부파일 (사진·파일)
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_url   text;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_type  text;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_name  text;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_size  int;

-- 첨부만 있고 텍스트 없을 때 허용
DO $$ BEGIN
  ALTER TABLE chat_messages ALTER COLUMN content DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_attachment_type_check;
  ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_attachment_type_check
    CHECK (attachment_type IS NULL OR attachment_type IN ('image','file'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- DM·group 참가자 테이블 (club_wide 는 club_memberships 로 대체)
CREATE TABLE IF NOT EXISTS chat_room_members (
  room_id      uuid REFERENCES chat_rooms(id) ON DELETE CASCADE NOT NULL,
  user_id      uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  joined_at    timestamptz DEFAULT now() NOT NULL,
  last_read_at timestamptz,
  PRIMARY KEY (room_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_user ON chat_room_members(user_id);

-- chat_messages 발송 시 룸의 last_message_* 자동 갱신 (목록 정렬용)
CREATE OR REPLACE FUNCTION chat_room_touch_last_message()
RETURNS trigger AS $$
BEGIN
  UPDATE chat_rooms
     SET last_message_at = NEW.created_at,
         last_message_preview = LEFT(NEW.content, 80)
   WHERE id = NEW.room_id;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_room_touch ON chat_messages;
CREATE TRIGGER trg_chat_room_touch
AFTER INSERT ON chat_messages
FOR EACH ROW EXECUTE FUNCTION chat_room_touch_last_message();

-- RLS — chat_room_members 본인이 속한 룸 멤버만 조회 가능
ALTER TABLE chat_room_members ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "crm_select" ON chat_room_members;
CREATE POLICY "crm_select" ON chat_room_members FOR SELECT
  USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM chat_room_members crm
      WHERE crm.room_id = chat_room_members.room_id AND crm.user_id = auth.uid()
    )
  );
DROP POLICY IF EXISTS "crm_update_self" ON chat_room_members;
CREATE POLICY "crm_update_self" ON chat_room_members FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- chat_rooms RLS — DM·group 룸은 멤버만, club_wide 는 클럽 멤버만
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cr_select_member" ON chat_rooms;
CREATE POLICY "cr_select_member" ON chat_rooms FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_room_members
      WHERE room_id = chat_rooms.id AND user_id = auth.uid()
    )
    OR (
      type = 'club_wide' AND EXISTS (
        SELECT 1 FROM club_memberships
        WHERE club_id = chat_rooms.club_id
          AND user_id = auth.uid()
          AND status = 'approved'
      )
    )
  );

-- chat_messages RLS — 룸에 접근 가능하면 메시지도 가능
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cm_select_member" ON chat_messages;
CREATE POLICY "cm_select_member" ON chat_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM chat_room_members
      WHERE room_id = chat_messages.room_id AND user_id = auth.uid()
    )
    OR EXISTS (
      SELECT 1 FROM chat_rooms cr
      JOIN club_memberships cm ON cm.club_id = cr.club_id
      WHERE cr.id = chat_messages.room_id
        AND cr.type = 'club_wide'
        AND cm.user_id = auth.uid()
        AND cm.status = 'approved'
    )
  );
DROP POLICY IF EXISTS "cm_insert_member" ON chat_messages;
CREATE POLICY "cm_insert_member" ON chat_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND (
      EXISTS (
        SELECT 1 FROM chat_room_members
        WHERE room_id = chat_messages.room_id AND user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM chat_rooms cr
        JOIN club_memberships cm ON cm.club_id = cr.club_id
        WHERE cr.id = chat_messages.room_id
          AND cr.type = 'club_wide'
          AND cm.user_id = auth.uid()
          AND cm.status = 'approved'
      )
    )
  );
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
