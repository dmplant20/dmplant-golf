-- Read-only deployment gate. Run with psql -v ON_ERROR_STOP=1 -f this_file.
-- No table rows, secrets, or personal data are read. A failure is intentional
-- until the existing production RLS defects have been repaired and tested.
BEGIN READ ONLY;
DO $check$
DECLARE unsafe_tables text; unsafe_functions text; dangerous_grants text;
BEGIN
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO unsafe_tables
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p') AND NOT c.relrowsecurity
    AND (has_table_privilege('anon',c.oid,'SELECT,INSERT,UPDATE,DELETE')
      OR has_table_privilege('authenticated',c.oid,'SELECT,INSERT,UPDATE,DELETE'));
  SELECT string_agg(p.oid::regprocedure::text, ', ') INTO unsafe_functions
  FROM pg_catalog.pg_proc p JOIN pg_catalog.pg_namespace n ON n.oid=p.pronamespace
  WHERE n.nspname='public' AND p.prokind='f'
    AND NOT EXISTS (SELECT 1 FROM unnest(p.proconfig) v WHERE v LIKE 'search_path=%')
    AND NOT EXISTS (SELECT 1 FROM pg_catalog.pg_depend d
      WHERE d.classid='pg_proc'::regclass AND d.objid=p.oid AND d.deptype='e');
  SELECT string_agg(c.relname, ', ' ORDER BY c.relname) INTO dangerous_grants
  FROM pg_catalog.pg_class c JOIN pg_catalog.pg_namespace n ON n.oid=c.relnamespace
  WHERE n.nspname='public' AND c.relkind IN ('r','p')
    AND (has_table_privilege('anon',c.oid,'TRUNCATE,TRIGGER,REFERENCES')
      OR has_table_privilege('authenticated',c.oid,'TRUNCATE,TRIGGER,REFERENCES'));
  IF unsafe_tables IS NOT NULL OR unsafe_functions IS NOT NULL OR dangerous_grants IS NOT NULL THEN
    RAISE EXCEPTION 'Security gate failed: RLS disabled [%]; unset function search_path [%]; dangerous client grants [%]',
      coalesce(unsafe_tables,''), coalesce(unsafe_functions,''), coalesce(dangerous_grants,'');
  END IF;
END
$check$;
ROLLBACK;
