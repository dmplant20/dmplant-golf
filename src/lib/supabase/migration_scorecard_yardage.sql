-- ═══════════════════════════════════════════════════════════════════════
-- Migration: Personal round holes – yardage column
-- Run in Supabase SQL Editor (Settings → SQL Editor → New query)
-- ═══════════════════════════════════════════════════════════════════════

-- 1. 야디지 컬럼 추가
ALTER TABLE personal_round_holes
  ADD COLUMN IF NOT EXISTS yardage int CHECK (yardage BETWEEN 50 AND 1000);

-- Apply through a reviewed administrative migration only.
-- The legacy app_run_migration SECURITY DEFINER RPC installer was removed.
-- Club memberships are not an authority to execute schema changes.
