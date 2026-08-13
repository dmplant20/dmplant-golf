-- ════════════════════════════════════════════════════════════════════════════
-- 'guest' 역할 추가 — 정회원이 아닌 게스트는 회비·재무 등에서 제외
-- ════════════════════════════════════════════════════════════════════════════
-- Supabase SQL Editor 에서 1회 실행하세요.
-- ────────────────────────────────────────────────────────────────────────────

-- 1) 기존 role CHECK 제약 해제 후 'guest' 포함하여 재생성
ALTER TABLE club_memberships DROP CONSTRAINT IF EXISTS club_memberships_role_check;
ALTER TABLE club_memberships ADD CONSTRAINT club_memberships_role_check
  CHECK (role IN (
    'president','vice_president','secretary','auditor','advisor','officer','member','guest'
  ));

-- 2) RLS 보호 강화 — 게스트는 finance_transactions / sponsorships 의
--    조회 권한을 잃도록 정책에서 제외.
--    (status='approved' AND role != 'guest' 조건으로 좁힘)

-- finance_transactions: 기존 SELECT 정책에 guest 제외
DROP POLICY IF EXISTS "finance_transactions_select" ON finance_transactions;
CREATE POLICY "finance_transactions_select" ON finance_transactions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = finance_transactions.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.status  = 'approved'
        AND club_memberships.role   <> 'guest'
    )
  );

-- sponsorships: 동일하게 guest 제외
DROP POLICY IF EXISTS "sponsorships_select" ON sponsorships;
CREATE POLICY "sponsorships_select" ON sponsorships FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = sponsorships.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.status  = 'approved'
        AND club_memberships.role   <> 'guest'
    )
  );

-- 3) Done. 클라이언트에서도 role==='guest' 일 때 메뉴/페이지를 가립니다.
-- ════════════════════════════════════════════════════════════════════════════
