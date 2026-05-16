-- ════════════════════════════════════════════════════════════════════════════
-- 채팅 확장: 1:1 DM + 그룹 채팅 + 사진·파일 첨부
-- ────────────────────────────────────────────────────────────────────────────
-- 사용법: Supabase Dashboard → SQL Editor → 새 쿼리 → 전체 붙여넣기 → Run
-- 모두 IF NOT EXISTS / DO $$ ... EXCEPTION 패턴이라 여러 번 실행해도 안전.
-- ════════════════════════════════════════════════════════════════════════════

-- ── 1. chat_rooms: 'dm' 타입 추가 + 메타 컬럼 ──────────────────────────────
DO $$ BEGIN
  ALTER TABLE chat_rooms DROP CONSTRAINT IF EXISTS chat_rooms_type_check;
  ALTER TABLE chat_rooms ADD CONSTRAINT chat_rooms_type_check
    CHECK (type IN ('club_wide','group','tournament_group','dm'));
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS created_by           uuid REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS last_message_at      timestamptz;
ALTER TABLE chat_rooms ADD COLUMN IF NOT EXISTS last_message_preview text;

-- ── 2. chat_messages: 첨부파일 컬럼 ────────────────────────────────────────
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_url   text;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_type  text;   -- 'image' | 'file'
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_name  text;
ALTER TABLE chat_messages ADD COLUMN IF NOT EXISTS attachment_size  int;

-- 첨부만 있고 텍스트 없을 때 허용 — content NOT NULL 제거
DO $$ BEGIN
  ALTER TABLE chat_messages ALTER COLUMN content DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

-- attachment_type 체크
DO $$ BEGIN
  ALTER TABLE chat_messages DROP CONSTRAINT IF EXISTS chat_messages_attachment_type_check;
  ALTER TABLE chat_messages ADD CONSTRAINT chat_messages_attachment_type_check
    CHECK (attachment_type IS NULL OR attachment_type IN ('image','file'));
EXCEPTION WHEN others THEN NULL;
END $$;

-- ── 3. chat_room_members 테이블 (DM·그룹 참가자) ──────────────────────────
CREATE TABLE IF NOT EXISTS chat_room_members (
  room_id      uuid REFERENCES chat_rooms(id) ON DELETE CASCADE NOT NULL,
  user_id      uuid REFERENCES users(id) ON DELETE CASCADE NOT NULL,
  joined_at    timestamptz DEFAULT now() NOT NULL,
  last_read_at timestamptz,
  PRIMARY KEY (room_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_chat_room_members_user ON chat_room_members(user_id);

-- ── 4. 메시지 발송 시 룸 last_message_* 자동 갱신 트리거 ──────────────────
CREATE OR REPLACE FUNCTION chat_room_touch_last_message()
RETURNS trigger AS $$
BEGIN
  UPDATE chat_rooms
     SET last_message_at = NEW.created_at,
         last_message_preview = COALESCE(
           LEFT(NEW.content, 80),
           CASE WHEN NEW.attachment_type = 'image' THEN '📷 사진'
                WHEN NEW.attachment_type = 'file'  THEN '📎 파일'
                ELSE '' END
         )
   WHERE id = NEW.room_id;
  RETURN NEW;
END
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_chat_room_touch ON chat_messages;
CREATE TRIGGER trg_chat_room_touch
AFTER INSERT ON chat_messages
FOR EACH ROW EXECUTE FUNCTION chat_room_touch_last_message();

-- ── 5. RLS — chat_room_members ────────────────────────────────────────────
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
  USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- ── 6. RLS — chat_rooms (DM/group 은 멤버만, club_wide 는 클럽 멤버) ──────
ALTER TABLE chat_rooms ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "cr_select_member" ON chat_rooms;
CREATE POLICY "cr_select_member" ON chat_rooms FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM chat_room_members WHERE room_id = chat_rooms.id AND user_id = auth.uid())
    OR (
      type = 'club_wide' AND EXISTS (
        SELECT 1 FROM club_memberships
        WHERE club_id = chat_rooms.club_id AND user_id = auth.uid() AND status = 'approved'
      )
    )
  );

-- ── 7. RLS — chat_messages (룸 접근 가능하면 메시지 가능) ─────────────────
ALTER TABLE chat_messages ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cm_select_member" ON chat_messages;
CREATE POLICY "cm_select_member" ON chat_messages FOR SELECT
  USING (
    EXISTS (SELECT 1 FROM chat_room_members WHERE room_id = chat_messages.room_id AND user_id = auth.uid())
    OR EXISTS (
      SELECT 1 FROM chat_rooms cr
      JOIN club_memberships cm ON cm.club_id = cr.club_id
      WHERE cr.id = chat_messages.room_id AND cr.type = 'club_wide'
        AND cm.user_id = auth.uid() AND cm.status = 'approved'
    )
  );

DROP POLICY IF EXISTS "cm_insert_member" ON chat_messages;
CREATE POLICY "cm_insert_member" ON chat_messages FOR INSERT
  WITH CHECK (
    user_id = auth.uid() AND (
      EXISTS (SELECT 1 FROM chat_room_members WHERE room_id = chat_messages.room_id AND user_id = auth.uid())
      OR EXISTS (
        SELECT 1 FROM chat_rooms cr
        JOIN club_memberships cm ON cm.club_id = cr.club_id
        WHERE cr.id = chat_messages.room_id AND cr.type = 'club_wide'
          AND cm.user_id = auth.uid() AND cm.status = 'approved'
      )
    )
  );

-- ── 8. Storage: 채팅 첨부파일 버킷 ────────────────────────────────────────
-- 'chat-attachments' 버킷 생성 (없으면). public=false → RLS 로 접근 통제
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('chat-attachments', 'chat-attachments', false, 20971520, NULL)  -- 20MB 제한
ON CONFLICT (id) DO UPDATE SET file_size_limit = 20971520;

-- 인증된 사용자가 본인이 속한 룸 폴더에 업로드/조회 가능
-- 객체 경로 규칙: {room_id}/{timestamp}_{filename}
DROP POLICY IF EXISTS "chat_attach_select" ON storage.objects;
CREATE POLICY "chat_attach_select" ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments' AND (
      EXISTS (
        SELECT 1 FROM chat_room_members
        WHERE room_id::text = (storage.foldername(name))[1] AND user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM chat_rooms cr
        JOIN club_memberships cm ON cm.club_id = cr.club_id
        WHERE cr.id::text = (storage.foldername(name))[1] AND cr.type = 'club_wide'
          AND cm.user_id = auth.uid() AND cm.status = 'approved'
      )
    )
  );

DROP POLICY IF EXISTS "chat_attach_insert" ON storage.objects;
CREATE POLICY "chat_attach_insert" ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments' AND (
      EXISTS (
        SELECT 1 FROM chat_room_members
        WHERE room_id::text = (storage.foldername(name))[1] AND user_id = auth.uid()
      )
      OR EXISTS (
        SELECT 1 FROM chat_rooms cr
        JOIN club_memberships cm ON cm.club_id = cr.club_id
        WHERE cr.id::text = (storage.foldername(name))[1] AND cr.type = 'club_wide'
          AND cm.user_id = auth.uid() AND cm.status = 'approved'
      )
    )
  );

-- ════════════════════════════════════════════════════════════════════════════
-- ✅ 완료. 위 쿼리가 모두 성공하면 채팅 DM/그룹/첨부파일 기능 사용 가능.
-- ════════════════════════════════════════════════════════════════════════════
