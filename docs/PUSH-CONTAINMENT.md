# Push/cron containment, local code only

Findings from source, no production data read and no actual notification sent:
- push/test accepts arbitrary target_user_id after checking sender's unrelated club role, then returns target name/email. Existing roles unverified.
- push/send-direct accepts arbitrary recipients after login, no shared room, message or club binding.
- push/send trusts legacy membership roles for mass delivery.
- push/diagnostics trusts legacy roles and returns member emails/logs; public debug/push-config exposes deployment metadata.
- birthday/check and meetings/notify skip authentication entirely when CRON_SECRET is absent. They perform service-role data reads and notification writes/sends.
- shared webpush sender uses stored arbitrary endpoint without delivery-host validation, returns endpoint prefixes and raw errors; self test should not reuse it.

Patch: unconditional 403 for management diagnostics, bulk/direct delivery, public deployment debug. Birthday and meeting crons require a configured exact bearer and remain 503 paused even for valid credentials pending recipient verification. No data reads, logging writes, delete or network in those routes.

Self web-push test retained: real getUser, cookie/RLS client, exact actor subscriptions only; no service key, profiles, arbitrary recipients or clubs. Fixed non-sensitive message and app-local navigation. At most five subscriptions; known exact HTTPS provider hosts and bounded keys; all subscriptions validated before any send; unknown/unsafe host fails closed. No redirects in installed web-push implementation (https.request), TTL60, timeout5s. Generic counts/errors only; no endpoint/key details, logs or subscription deletion. Custom title/body ignored. Native self-test and unsupported browser providers are not preserved by this containment. Existing shared native sender remains unchanged and not called here.

User-visible interruption: club announcements push, direct chat push, administrator diagnostics/tests, birthday alerts and scheduled meeting reminders pause. Actual chat/posts/calendar data not removed. Subscription registration and unsubscribe routes stay unchanged. Safe self browser test succeeds only with valid supported subscriptions/configuration. No claim all outbound notification paths are now audited: other service-role routes and shared senders require separate review, as do subscription table RLS/ACL and history integrity.

Restore bulk/direct/cron only after reviewed actor authority and membership evidence, target exact-tenant/room membership, real server-saved message linkage, privacy preferences, transport validation, durable idempotency/rate limits, concurrency and real staging tests. Do not restore by simply re-enabling legacy role checks. Cron configuration may need deliberate scheduler pause separately; no scheduler settings changed here.

Validation: 16 isolated synthetic tests (stubbed transport; no DB/network), TypeScript and targeted ESLint passed. Full existing repo test suite/build, actual web delivery, native delivery, browser UI and production deployment not run. Independently review exact commit before publishing. Push admin UI currently sees explicit error instead of diagnostics; no UI rewrite bundled.
