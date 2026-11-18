/**
 * Compatibility tombstone. Runtime migrations used to recreate security policies
 * and triggers with owner credentials, potentially undoing reviewed hardening.
 * No connection, DDL, data backfill, or implicit retry is allowed here.
 * Apply reviewed versioned migrations outside application request handling.
 */
export async function autoMigrate(): Promise<void> {
  throw new Error('Runtime schema migration is disabled; use reviewed versioned migrations')
}
