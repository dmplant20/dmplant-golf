-- Recorded copy of migration already applied to production 2026-11-18.
-- Function bodies and ACLs are unchanged.
ALTER FUNCTION public.chat_room_touch_last_message() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.handle_new_club() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.handle_new_user() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.insert_golf_course_full(text,text,text,text,text,text,text,text,text,numeric,numeric,text,text,text,integer,integer,integer) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.insert_golf_hole(uuid,integer,integer,integer,integer,text,text) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.seed_placeholder_18(uuid) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.seed_placeholder_27(uuid) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.seed_placeholder_36(uuid) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.seed_placeholder_9(uuid) SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.set_updated_at() SET search_path = pg_catalog, public, pg_temp;
ALTER FUNCTION public.update_round_total_score() SET search_path = pg_catalog, public, pg_temp;
