-- 첫 로그인 비밀번호 설정 플래그
ALTER TABLE users ADD COLUMN IF NOT EXISTS needs_password_reset boolean DEFAULT false;

-- 기존에 batch-register로 등록된 회원들 (300 클럽)을 첫 로그인 대상으로 표시
-- ※ 이미 비밀번호를 직접 설정한 회원은 false 유지
UPDATE users
SET needs_password_reset = true
WHERE needs_password_reset IS NULL OR needs_password_reset = false
  AND id IN (
    SELECT user_id FROM club_memberships
    WHERE club_id = (SELECT id FROM clubs WHERE name = '300')
      AND status = 'approved'
  );
