# Security repair map (2026-11-18)

Inspected commit: `af968d27d9f921b6c2b085345b63208990c9b0f5`.
This is a proposed policy/test design, not evidence that RLS is repaired.
Do not apply blanket policies to production without the integration tests below.

## Confirmed access paths

* `layout.tsx`: authenticated users read their own full `users` row and approved
  memberships, with embedded club details. Denial currently looks like onboarding.
* `register/page.tsx`: user upsert, with email from signup. The auth trigger may
  already create this row. Profile edits need only names, phone, birth_date, avatar.
* `lib/superAdmin.ts`: server authorization uses verified auth user's email
  allowlist; browser authorization uses public profile email. `is_developer` is
  not this application's authority. Never authorize from client-editable profile
  email or user_metadata. Protect email/id/is_developer and server-owned flags.
* `onboarding/page.tsx`, `club-register/page.tsx`: club INSERT with created_by,
  followed by creator president/approved membership INSERT. Ordinary application
  uses membership UPSERT member/pending. Check trigger-created membership duplicate
  behavior. A withdrawn member must not restore approval through UPSERT.
* `members/page.tsx`: approved members including guests see the approved roster;
  president/secretary manage approval, rejection, withdrawal, reinstatement,
  handicap, fee_type, and roles. Role delegation uses two non-atomic writes.
  Pending/withdrawn queries currently execute for all clients, not just managers.
* `finance/page.tsx`: full finance viewing roles are president, secretary, auditor,
  advisor. General finance management is secretary; president can confirm fines.
  `members/page.tsx` also lets president add/delete fee receipts.
* `dashboard/page.tsx` and finance page fetch club transactions and calculate
  balances/progress in-browser. Restricting rows to own transactions without
  replacing these calculations produces incorrect club balances.
* `api/finance/my-unpaid`: cookie-user client, own approved memberships and own
  payments/fines. Query errors are currently ignored. Error != zero debt.
* `api/finance/mark-fine-paid`: verified auth user, service client, approved
  president/secretary or superadmin; conditional update makes repeat confirmation
  idempotent. Missing service key falls back to unauthenticated anon client.
* `api/scores/upsert` and `api/scores/handicap`: service-role writes after membership
  checks. General members can submit own scores; president/secretary others.
  Fine amounts/rules arrive from the client and need authoritative server validation.
* `scorecard/page.tsx`: ordinary user directly inserts own calculated fine and
  ignores DB errors. Do not preserve this by allowing arbitrary own finance INSERT.
  Move to validated server-side calculation with idempotency instead.
* Admin create-member/reset-password use service-role access. Test separately:
  RLS cannot protect service-role code from missing authorization checks.

## RLS implementation constraints

1. Revoke dangerous client table privileges (TRUNCATE bypasses row policies).
2. Membership policies cannot query themselves recursively. If a narrowly scoped
   SECURITY DEFINER membership helper is necessary, put it in a private schema,
   pin its search_path, explicitly authorize uid, and restrict EXECUTE.
3. Membership INSERT: only own pending member application, or club-creator bootstrap
   atomically via trusted trigger. No self role/status/identity reassignment.
4. Management policies require an approved manager in that exact club; validate
   both old and new row. Forbid changing user_id/club_id, even for managers.
5. Profile RLS alone does not hide columns. Same-club SELECT of `users` exposes
   email/birthday etc even if UI selects names. Prefer an authorized, minimal
   roster projection; own profile remains separately accessible.
6. Finance: own receipts plus specifically authorized club finance readers; writes
   constrained by operation and role. Implement an authorized aggregate endpoint
   for ordinary members instead of granting all transaction rows for totals.
7. Check FK relationships and embedded SELECT permissions, not just table queries.
8. Stop converting query failures or filtered updates into successful empty state.
   Rollback must not restore public unrestricted CRUD as a convenient workaround.

## Synthetic non-production verification matrix

Use two clubs with separate approved presidents/secretaries; approved ordinary,
guest, auditor, advisor, pending and withdrawn users, plus an outsider and anonymous
client. Seed no real personal data. Do not test writes against production.

* Anonymous: cannot enumerate or mutate users, membership, finance.
* Ordinary/guest: own profile login works; safe same-club roster works; other-club
  private rows denied; pending/withdrawn roster not disclosed.
* Self-edit: names/avatar work; email spoofing, is_developer, id, role/status,
  club_id/user_id changes rejected; INSERT/UPSERT cannot bypass UPDATE checks.
* Apply/reapply: pending only; no self approval; creator bootstrap succeeds once.
* Manager: approve/withdraw/reinstate same club works, another club denied;
  atomic role delegation leaves a valid manager and preserves identity columns.
* Finance reader vs writer: auditor/advisor read authorized records but cannot
  write; guest/ordinary cannot forge or delete receipts/fines; president fee and
  fine-confirm operations work; secretary management works. Test amounts, member
  club ownership, recorded_by spoofing, cross-club reassignment, duplicate submits.
* Own unpaid API: DB errors return failure, never paid/unpaid conclusions from
  missing data. Test annual/monthly fees and meeting overrides.
* Dashboard aggregate totals equal seeded expected values for each role.
* Score submission: ordinary own score accepted, others denied; no arbitrary fine
  amount/rule injection; repeat submission doesn't duplicate fines.
* Membership revocation takes effect with an existing session, not only new login.
* `scripts/security/check-database-security.sql` fails on baseline defects, passes
  only after tested repairs; run advisors and actual PostgREST tests as well.

No automated test currently exists in package.json. This matrix is not a test pass.

## Implemented local safeguards (not yet deployed)

* `api/auth/first-login` always returns 403, with no body parsing, database access,
  admin link generation or auth token response. The old email-only bootstrap
  allowed account access without mailbox possession. Synthetic tests only.
* Login no longer requests that endpoint or suggests leaving passwords blank.
  Existing password sign-in and reset routes remain. Pre-created users who relied
  on email-only login must reset by email or receive a separately verified setup
  flow; actual mail delivery has NOT been tested by this change.
* Removed password Base64 persistence/autofill/replay. Browser client startup
  deletes only the old password key without reading it; remembered email and
  Supabase session cookies/storage are retained. Expired/revoked sessions now go
  to login rather than replaying the user's password. Native OAuth unchanged.
* Missing service role configuration returns 503 for three privileged write APIs.
* Own-unpaid query failures return 503 rather than incomplete financial conclusions.
  Existing modal currently suppresses unsuccessful requests; a future UX should
  visibly report unavailable status without alarming users with invented debt.

Run `node --test scripts/security/test-*.cjs`, `npx tsc --noEmit`, and `npm run build`.
Mock tests cover fail-closed paths and storage/session configuration preservation,
not an actual user's browser, real email delivery, or production RLS enforcement.
The migration under `supabase/migrations` records the exact already-applied
`20261118170348` function search_path change, not a new production operation.

* Emergency follow-up: admin/reset-password and admin/create-member are temporarily
  closed (403). They trusted unprotected membership roles to authorize privileged
  Auth writes. Restore only after trusted role enforcement and mailbox ownership
  setup are implemented and verified. Existing self-service recovery is unchanged.
