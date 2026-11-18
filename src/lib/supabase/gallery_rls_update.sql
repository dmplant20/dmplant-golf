-- ════════════════════════════════════════════════════════════════════════════
-- album_photos UPDATE 정책 — 캡션 편집 가능하도록
-- ────────────────────────────────────────────────────────────────────────────
-- 사용법: Supabase SQL Editor → 새 쿼리 → 붙여넣기 → Run
-- ────────────────────────────────────────────────────────────────────────────
-- 이전 SQL 에는 SELECT/INSERT/DELETE 만 있고 UPDATE 정책이 없어
-- 캡션 편집이 RLS에 막혀 무음 실패. 본인 + 회장·총무가 UPDATE 가능하도록.
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "photos_update" ON album_photos;
CREATE POLICY "photos_update" ON album_photos FOR UPDATE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM albums a
      JOIN club_memberships cm ON cm.club_id = a.club_id
      WHERE a.id = album_photos.album_id AND cm.user_id = auth.uid()
        AND cm.role IN ('president','secretary') AND cm.status = 'approved'
    )
  )
  WITH CHECK (true);

-- ════════════════════════════════════════════════════════════════════════════
-- ✅ 적용 후: 본인이 올린 사진 또는 회장·총무가 모든 사진의 캡션 편집 가능
--    삭제는 이전부터 동일 권한으로 가능 (photos_delete 정책)
--    다운로드는 RLS 와 무관 — public bucket 의 URL 직접 fetch
-- ════════════════════════════════════════════════════════════════════════════
