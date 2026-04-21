-- Migration: Club payment info (bank account / QR code)
-- Run in Supabase SQL Editor

CREATE TABLE IF NOT EXISTS club_payment_info (
  id           uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  club_id      uuid REFERENCES clubs(id) ON DELETE CASCADE NOT NULL UNIQUE,
  bank_name    text,
  bank_account text,
  bank_holder  text,
  qr_image_url text,
  memo         text,
  updated_by   uuid REFERENCES users(id),
  updated_at   timestamptz DEFAULT now()
);

ALTER TABLE club_payment_info ENABLE ROW LEVEL SECURITY;

-- 클럽 멤버 전체 조회 가능
CREATE POLICY "payment_info_select" ON club_payment_info FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = club_payment_info.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.status  = 'approved'
    )
  );

-- 회장·총무만 등록/수정/삭제
CREATE POLICY "payment_info_insert" ON club_payment_info FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = club_payment_info.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.role    IN ('president', 'secretary')
        AND club_memberships.status  = 'approved'
    )
  );

CREATE POLICY "payment_info_update" ON club_payment_info FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = club_payment_info.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.role    IN ('president', 'secretary')
        AND club_memberships.status  = 'approved'
    )
  );

CREATE POLICY "payment_info_delete" ON club_payment_info FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM club_memberships
      WHERE club_memberships.club_id = club_payment_info.club_id
        AND club_memberships.user_id = auth.uid()
        AND club_memberships.role    IN ('president', 'secretary')
        AND club_memberships.status  = 'approved'
    )
  );
