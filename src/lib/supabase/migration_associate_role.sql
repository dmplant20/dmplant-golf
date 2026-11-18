-- ════════════════════════════════════════════════════════════════════════════
-- 'associate' (준회원) 역할 추가
--   · 월/년 회비 면제 — 참석한 달에만 회비를 납부
--   · 정회원과 같은 화면 접근 권한 유지 (회원 명부·재무·정기모임 모두)
-- ────────────────────────────────────────────────────────────────────────────
-- Supabase SQL Editor 에서 1회 실행하세요.
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE club_memberships DROP CONSTRAINT IF EXISTS club_memberships_role_check;
ALTER TABLE club_memberships ADD CONSTRAINT club_memberships_role_check
  CHECK (role IN (
    'president','vice_president','secretary','auditor','advisor','officer',
    'member','associate','guest'
  ));

-- ════════════════════════════════════════════════════════════════════════════
-- ✅ 적용 완료. 코드는 role='associate' 인 회원을 회비 의무에서 자동 제외합니다.
-- ════════════════════════════════════════════════════════════════════════════
