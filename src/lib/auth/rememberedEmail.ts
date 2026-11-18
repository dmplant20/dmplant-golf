// Remember only the login identifier. Authentication persistence belongs to Supabase.
const EMAIL_KEY = 'isgolf-saved-email'
const LEGACY_PASSWORD_KEY = 'isgolf-saved-pw'

export function clearLegacyPassword() {
  if (typeof window === 'undefined') return
  try { window.localStorage.removeItem(LEGACY_PASSWORD_KEY) } catch { /* storage disabled */ }
}

export function readRememberedEmail(): string {
  clearLegacyPassword()
  if (typeof window === 'undefined') return ''
  try { return window.localStorage.getItem(EMAIL_KEY) ?? '' } catch { return '' }
}

export function rememberEmail(email: string) {
  clearLegacyPassword()
  if (typeof window === 'undefined') return
  try { if (email) window.localStorage.setItem(EMAIL_KEY, email) } catch { /* storage disabled */ }
}
