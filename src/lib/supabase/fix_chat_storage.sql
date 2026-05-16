-- ════════════════════════════════════════════════════════════════════════════
-- 채팅 첨부 Storage RLS 완화 — 사진·파일 업로드 차단 해결
-- ────────────────────────────────────────────────────────────────────────────
-- 사용법: Supabase SQL Editor → 새 쿼리 → 붙여넣기 → Run
-- ────────────────────────────────────────────────────────────────────────────
-- 기존 정책은 storage.foldername 매칭이 까다로워 인증된 회원도 업로드 실패.
-- 단순화: 인증된 사용자는 chat-attachments 에 자유 업로드.
-- (메시지 INSERT 권한은 chat_messages RLS 가 이미 통제하므로 안전.)
-- ════════════════════════════════════════════════════════════════════════════

DROP POLICY IF EXISTS "chat_attach_select" ON storage.objects;
DROP POLICY IF EXISTS "chat_attach_insert" ON storage.objects;
DROP POLICY IF EXISTS "chat_attach_update" ON storage.objects;
DROP POLICY IF EXISTS "chat_attach_delete" ON storage.objects;

CREATE POLICY "chat_attach_select" ON storage.objects
  FOR SELECT TO authenticated
  USING (bucket_id = 'chat-attachments');

CREATE POLICY "chat_attach_insert" ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'chat-attachments');

-- (UPDATE/DELETE 는 의도적 비활성 — 한번 업로드 후 수정·삭제 불필요)
-- ════════════════════════════════════════════════════════════════════════════
-- ✅ 적용 후: 채팅창에서 사진·파일 즉시 업로드 가능.
-- ════════════════════════════════════════════════════════════════════════════
