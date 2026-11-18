# Runtime migration containment

The removed runtime migrator connected with DATABASE_URL while rendering pages
and through a public GET `/api/system/init`. It recreated policies and triggers,
changed constraints and performed data backfills. It had no durable migration
ledger and could overwrite reviewed security changes on a cold start.

The root no longer invokes it; init returns 410; the old exported function is a
fail-closed compatibility tombstone with no database access. Existing SQL remains
recoverable from Git history, not as an executable runtime path. New schema
changes must be reviewed/versioned and applied through an authorized administrative
migration workflow, separately from app deployments.

Before this change, production metadata was inspected without reading data rows:
all legacy ADD COLUMN targets and six actual CREATE TABLE targets already existed.
The hardened three auth/chat trigger function search paths remained present at
inspection. Therefore no missing-column/table bootstrap was needed on page load.
This does not assert that all current policies or constraints are safe.

Synthetic PostgreSQL reproduced that CREATE OR REPLACE FUNCTION without a SET
clause clears an existing function search_path. Removing the runtime DDL prevents
that regression and prevents permissive policy reintroduction.

Remaining work: tested RLS rollout plus application compatibility, verification of
existing administrator roles against trusted evidence, and operator-controlled
migrations for new installs. Do not restore the runtime owner-credential path.

Legacy auth/chat SQL function definitions also retain the pinned search_path, so a
reviewed manual replay cannot silently erase that specific hardening. These files
are not automatically executed by application requests.

The separate `/api/admin/migrate` GET/POST and its legacy callable RPC installer
are also removed. No application references to these migration endpoints were
found. Existing operator SQL for the yardage column remains a manual migration.
