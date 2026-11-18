-- ════════════════════════════════════════════════════════════════════════════
-- 갤러리 (사진 앨범) 확장 — 테마 분류 + 모든 회원 업로드 가능
-- ────────────────────────────────────────────────────────────────────────────
-- 사용법: Supabase SQL Editor → 새 쿼리 → 붙여넣기 → Run
-- ════════════════════════════════════════════════════════════════════════════

-- 1. albums 확장 컬럼 — 테마, 설명, 작성자
ALTER TABLE albums ADD COLUMN IF NOT EXISTS theme       text DEFAULT 'casual';
ALTER TABLE albums ADD COLUMN IF NOT EXISTS description text;
ALTER TABLE albums ADD COLUMN IF NOT EXISTS created_by  uuid REFERENCES users(id) ON DELETE SET NULL;

-- theme 체크 (시상식, 라운드, 모임, 행사, 여행, 일상)
DO $$ BEGIN
  ALTER TABLE albums DROP CONSTRAINT IF EXISTS albums_theme_check;
  ALTER TABLE albums ADD CONSTRAINT albums_theme_check
    CHECK (theme IN ('awards','tournament','meeting','event','travel','casual'));
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE INDEX IF NOT EXISTS idx_albums_club_theme ON albums(club_id, theme, created_at DESC);

-- 2. album_photos 확장 — 캡션
ALTER TABLE album_photos ADD COLUMN IF NOT EXISTS caption text;

-- 3. albums RLS — 클럽 멤버는 누구나 조회·생성 / 작성자·임원은 수정·삭제
ALTER TABLE albums ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "albums_select" ON albums;
CREATE POLICY "albums_select" ON albums FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM club_memberships
    WHERE club_id = albums.club_id AND user_id = auth.uid() AND status = 'approved'
  ));

DROP POLICY IF EXISTS "albums_insert" ON albums;
CREATE POLICY "albums_insert" ON albums FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM club_memberships
    WHERE club_id = albums.club_id AND user_id = auth.uid() AND status = 'approved'
  ));

DROP POLICY IF EXISTS "albums_update" ON albums;
CREATE POLICY "albums_update" ON albums FOR UPDATE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_id = albums.club_id AND user_id = auth.uid()
        AND role IN ('president','secretary') AND status = 'approved'
    )
  );

DROP POLICY IF EXISTS "albums_delete" ON albums;
CREATE POLICY "albums_delete" ON albums FOR DELETE TO authenticated
  USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_id = albums.club_id AND user_id = auth.uid()
        AND role IN ('president','secretary') AND status = 'approved'
    )
  );

-- 4. album_photos RLS — 클럽 멤버는 누구나 열람·업로드 / 본인 업로드는 본인이 삭제
ALTER TABLE album_photos ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "photos_select" ON album_photos;
CREATE POLICY "photos_select" ON album_photos FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM albums a
    JOIN club_memberships cm ON cm.club_id = a.club_id
    WHERE a.id = album_photos.album_id AND cm.user_id = auth.uid() AND cm.status = 'approved'
  ));

DROP POLICY IF EXISTS "photos_insert" ON album_photos;
CREATE POLICY "photos_insert" ON album_photos FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND EXISTS (
      SELECT 1 FROM albums a
      JOIN club_memberships cm ON cm.club_id = a.club_id
      WHERE a.id = album_photos.album_id AND cm.user_id = auth.uid() AND cm.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "photos_delete" ON album_photos;
CREATE POLICY "photos_delete" ON album_photos FOR DELETE TO authenticated
  USING (
    uploaded_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM albums a
      JOIN club_memberships cm ON cm.club_id = a.club_id
      WHERE a.id = album_photos.album_id AND cm.user_id = auth.uid()
        AND cm.role IN ('president','secretary') AND cm.status = 'approved'
    )
  );

-- 5. Storage club-media 버킷 RLS — 클럽 멤버는 인증되면 누구나 업로드
INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('club-media', 'club-media', true, 20971520)
ON CONFLICT (id) DO UPDATE SET public = true, file_size_limit = 20971520;

DROP POLICY IF EXISTS "club_media_select" ON storage.objects;
CREATE POLICY "club_media_select" ON storage.objects FOR SELECT
  USING (bucket_id = 'club-media');  -- public bucket — 누구나 조회 (signed URL 불필요)

DROP POLICY IF EXISTS "club_media_insert" ON storage.objects;
CREATE POLICY "club_media_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'club-media');

-- ════════════════════════════════════════════════════════════════════════════
-- ✅ 완료. 모든 회원이 갤러리 사진 업로드·앨범 생성 가능.
-- ════════════════════════════════════════════════════════════════════════════
