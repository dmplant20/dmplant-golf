-- Fix meeting_attendances RLS policies
-- Run in Supabase SQL Editor if RSVP is failing

-- Fix constraint
ALTER TABLE meeting_attendances DROP CONSTRAINT IF EXISTS meeting_attendances_status_check;
ALTER TABLE meeting_attendances ADD CONSTRAINT meeting_attendances_status_check
  CHECK (status IN ('attending', 'absent'));

-- Enable RLS (idempotent)
ALTER TABLE meeting_attendances ENABLE ROW LEVEL SECURITY;

-- Drop all old policies (both naming conventions)
DROP POLICY IF EXISTS "att_select" ON meeting_attendances;
DROP POLICY IF EXISTS "att_insert" ON meeting_attendances;
DROP POLICY IF EXISTS "att_update" ON meeting_attendances;
DROP POLICY IF EXISTS "att_delete" ON meeting_attendances;
DROP POLICY IF EXISTS "ma_select" ON meeting_attendances;
DROP POLICY IF EXISTS "ma_upsert" ON meeting_attendances;
DROP POLICY IF EXISTS "ma_update" ON meeting_attendances;
DROP POLICY IF EXISTS "ma_delete" ON meeting_attendances;

-- Create correct policies
CREATE POLICY "ma_select" ON meeting_attendances FOR SELECT
  USING (EXISTS (SELECT 1 FROM club_memberships
    WHERE club_id = meeting_attendances.club_id
      AND user_id = auth.uid() AND status = 'approved'));

CREATE POLICY "ma_insert" ON meeting_attendances FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ma_update" ON meeting_attendances FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "ma_delete" ON meeting_attendances FOR DELETE
  USING (user_id = auth.uid());
