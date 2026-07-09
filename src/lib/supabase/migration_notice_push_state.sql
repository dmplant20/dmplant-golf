-- ════════════════════════════════════════════════════════════════════════════
-- 반복 공지 팝업 + 알림받기 상태 유지 버그 근본수정용 마이그레이션
-- 사용법: Supabase Dashboard → SQL Editor → 전체 붙여넣기 → Run
--   (Vercel 은 DATABASE_URL 이 있으면 src/lib/db-migrate.ts autoMigrate 로 자동 적용됨.
--    이 파일은 수동 적용/기록용.)
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1) 공지 팝업 반복 원인: meeting_attendances 저장 실패 ─────────────────────
-- (a) status CHECK 를 ('attending','absent') 로 고정 (팝업이 보내던 not_attending 은
--     API 에서 absent 로 정규화됨)
DO $$ BEGIN
  ALTER TABLE meeting_attendances DROP CONSTRAINT IF EXISTS meeting_attendances_status_check;
  ALTER TABLE meeting_attendances ADD CONSTRAINT meeting_attendances_status_check
    CHECK (status IN ('attending', 'absent'));
EXCEPTION WHEN others THEN NULL;
END $$;
-- (b) 구버전(migration_rsvp.sql)로 만들어진 테이블엔 reason 컬럼이 없어 upsert 가 실패했음.
ALTER TABLE meeting_attendances ADD COLUMN IF NOT EXISTS reason text;

-- ── 2) 알림받기 영속 플래그: push_opt_in ────────────────────────────────────
-- 토글/자동재구독 판정의 진실의 원천. SW unregister 로 로컬 구독이 사라져도 흔들리지 않음.
-- POST /api/push/subscribe → true, DELETE(all)=사용자 해지 → false.
ALTER TABLE user_notification_preferences
  ADD COLUMN IF NOT EXISTS push_opt_in boolean NOT NULL DEFAULT false;

-- 백필: 현재 push 구독이 있는 사용자는 이미 알림받기를 켠 상태로 간주(배포 후 상태 유지)
INSERT INTO user_notification_preferences (user_id, push_opt_in)
  SELECT DISTINCT user_id, true FROM push_subscriptions
  ON CONFLICT (user_id) DO UPDATE SET push_opt_in = true;

-- ════════════════════════════════════════════════════════════════════════════
-- 적용 후:
--  · 참석/불참 클릭 → meeting_attendances 저장 성공 → pending 이 재노출 차단
--  · 알림받기 상태는 push_opt_in 으로 유지 → 재접속/재배포/SW해제에도 흔들리지 않음
-- ════════════════════════════════════════════════════════════════════════════
