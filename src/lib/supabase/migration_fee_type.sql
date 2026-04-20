-- Migration: Add per-member fee_type to club_memberships
-- Run this in Supabase SQL Editor

-- 1. Add fee_type column to club_memberships (per-member, independent of club-wide setting)
ALTER TABLE club_memberships
  ADD COLUMN IF NOT EXISTS fee_type text CHECK (fee_type IN ('annual', 'monthly'));

-- 2. Remove the old club-wide fee_type column from clubs (no longer needed)
--    Annual fee and monthly fee amounts both coexist in clubs table.
--    Uncomment the line below ONLY after verifying no code references clubs.fee_type
-- ALTER TABLE clubs DROP COLUMN IF EXISTS fee_type;

-- Done. Each member now has their own fee_type (annual/monthly/null).
-- Annual and monthly fee amounts are set independently in clubs.annual_fee and clubs.monthly_fee.
