-- Migration: Regular meeting schedule with monthly overrides
-- Run this in Supabase SQL Editor

-- 1. Recurring meeting pattern (one per club)
CREATE TABLE IF NOT EXISTS recurring_meetings (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE NOT NULL UNIQUE,
  week_of_month int NOT NULL CHECK (week_of_month BETWEEN 1 AND 5),
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 0 AND 6), -- 0=Sun, 1=Mon, ..., 6=Sat
  start_time time NOT NULL DEFAULT '07:00',
  venue text,
  notes text,
  is_active boolean NOT NULL DEFAULT true,
  created_by uuid REFERENCES users(id),
  updated_at timestamptz DEFAULT now()
);

-- 2. Monthly overrides (cancel or reschedule a specific month)
CREATE TABLE IF NOT EXISTS meeting_overrides (
  id uuid DEFAULT uuid_generate_v4() PRIMARY KEY,
  club_id uuid REFERENCES clubs(id) ON DELETE CASCADE NOT NULL,
  year int NOT NULL,
  month int NOT NULL CHECK (month BETWEEN 1 AND 12),
  status text NOT NULL DEFAULT 'rescheduled'
    CHECK (status IN ('cancelled', 'rescheduled')),
  override_date date,          -- new date if rescheduled
  override_time time,          -- new time if changed (null = same as pattern)
  reason text,                 -- e.g. '설날', '폭설'
  created_by uuid REFERENCES users(id),
  created_at timestamptz DEFAULT now(),
  UNIQUE(club_id, year, month)
);
