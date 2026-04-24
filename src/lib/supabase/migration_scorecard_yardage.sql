-- Migration: Add yardage column to personal_round_holes
-- Run in Supabase SQL Editor

ALTER TABLE personal_round_holes
  ADD COLUMN IF NOT EXISTS yardage int CHECK (yardage BETWEEN 50 AND 1000);

-- Also fix hole_number constraint to allow 9-hole rounds properly
-- (the existing CHECK already allows 1-18, which covers 9-hole rounds)
