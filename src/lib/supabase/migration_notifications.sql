-- Migration: 푸시 알림 인프라 보강
-- 1) notification_logs : 모든 발송 결과 로그
-- 2) user_notification_preferences : 회원별 알림 종류 토글
-- 3) push_subscriptions RLS : 본인 것만 접근

-- ── notification_logs ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS notification_logs (
  id            uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id       uuid REFERENCES users(id) ON DELETE SET NULL,
  club_id       uuid REFERENCES clubs(id) ON DELETE SET NULL,
  -- 카테고리: announcement | meeting | finance | birthday | chat | test | admin
  type          text NOT NULL,
  title         text NOT NULL,
  body          text,
  url           text,
  -- 발송 상태: success | failed | skipped
  status        text NOT NULL CHECK (status IN ('success','failed','skipped')),
  -- 실패 분류: permission_denied | no_token | token_expired | server_key_error | api_error | preference_off | rate_limited | unknown
  error_code    text,
  error_message text,
  -- 발송 시도한 endpoint (디버깅용 — 앞 60자만 저장)
  endpoint_hint text,
  -- HTTP 상태코드 (FCM/Apple Push 응답)
  status_code   int,
  -- 발신자 (cron 이면 null, 사용자 액션이면 user_id)
  sent_by       uuid REFERENCES users(id) ON DELETE SET NULL,
  created_at    timestamptz DEFAULT now() NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_notification_logs_user      ON notification_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_club_time ON notification_logs(club_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_notification_logs_status    ON notification_logs(status, created_at DESC);

ALTER TABLE notification_logs ENABLE ROW LEVEL SECURITY;

-- 본인은 본인 로그만, 회장·총무는 같은 클럽 전체 로그 조회 가능
DROP POLICY IF EXISTS "nl_select" ON notification_logs;
CREATE POLICY "nl_select" ON notification_logs FOR SELECT USING (
  user_id = auth.uid()
  OR EXISTS (
    SELECT 1 FROM club_memberships
    WHERE club_id = notification_logs.club_id
      AND user_id = auth.uid()
      AND status  = 'approved'
      AND role IN ('president','secretary')
  )
);

-- INSERT 는 service_role 만 (모든 발송 경로가 서버에서 수행)
DROP POLICY IF EXISTS "nl_insert_none" ON notification_logs;
CREATE POLICY "nl_insert_none" ON notification_logs FOR INSERT WITH CHECK (false);

-- ── user_notification_preferences ────────────────────────────────────
CREATE TABLE IF NOT EXISTS user_notification_preferences (
  user_id        uuid REFERENCES users(id) ON DELETE CASCADE PRIMARY KEY,
  -- 마스터 스위치
  all_enabled    boolean NOT NULL DEFAULT true,
  -- 카테고리별 (true = 받음)
  announcements  boolean NOT NULL DEFAULT true,
  meetings       boolean NOT NULL DEFAULT true,
  finance        boolean NOT NULL DEFAULT true,
  chat           boolean NOT NULL DEFAULT true,
  birthday       boolean NOT NULL DEFAULT true,
  admin_test     boolean NOT NULL DEFAULT true,  -- 관리자 테스트 발송 수신 여부
  updated_at     timestamptz DEFAULT now() NOT NULL,
  created_at     timestamptz DEFAULT now() NOT NULL
);

ALTER TABLE user_notification_preferences ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "unp_select" ON user_notification_preferences;
CREATE POLICY "unp_select" ON user_notification_preferences FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "unp_upsert" ON user_notification_preferences;
CREATE POLICY "unp_upsert" ON user_notification_preferences FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "unp_update" ON user_notification_preferences;
CREATE POLICY "unp_update" ON user_notification_preferences FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── push_subscriptions RLS 보강 ──────────────────────────────────────
-- 기존: anon 으로 SELECT 가능 (이전 감사에서 발견된 보안 문제)
-- 변경: 본인 endpoint 만 조회/삭제/insert 가능
ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "ps_select" ON push_subscriptions;
CREATE POLICY "ps_select" ON push_subscriptions FOR SELECT
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ps_insert" ON push_subscriptions;
CREATE POLICY "ps_insert" ON push_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

DROP POLICY IF EXISTS "ps_delete" ON push_subscriptions;
CREATE POLICY "ps_delete" ON push_subscriptions FOR DELETE
  USING (user_id = auth.uid());

DROP POLICY IF EXISTS "ps_update" ON push_subscriptions;
CREATE POLICY "ps_update" ON push_subscriptions FOR UPDATE
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());
