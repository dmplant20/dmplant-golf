-- ════════════════════════════════════════════════════════════════════════════
-- 갤러리 — 앨범 행사일 + 사진 촬영 시각 추가
-- ────────────────────────────────────────────────────────────────────────────
-- 사용법: Supabase SQL Editor → 새 쿼리 → 붙여넣기 → Run
-- ════════════════════════════════════════════════════════════════════════════

ALTER TABLE albums       ADD COLUMN IF NOT EXISTS event_date date;
ALTER TABLE album_photos ADD COLUMN IF NOT EXISTS taken_at   timestamptz;

CREATE INDEX IF NOT EXISTS idx_albums_club_event_date ON albums(club_id, event_date DESC NULLS LAST);

-- ────────────────────────────────────────────────────────────────────────────
-- 효과:
--   albums.event_date  — 시상식·행사가 실제로 있었던 날짜 (수동 입력)
--   album_photos.taken_at — 사진 촬영 시각 (file.lastModified 자동 또는 수동)
-- ════════════════════════════════════════════════════════════════════════════
