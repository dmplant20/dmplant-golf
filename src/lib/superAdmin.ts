// src/lib/superAdmin.ts
// 개발자/오너 슈퍼관리자 — 어느 클럽이든 모든 권한 부여
// 클라이언트와 서버에서 모두 import 가능 (순수 함수)

const SUPER_ADMIN_EMAILS: string[] = [
  'dmplant@naver.com',   // 프로젝트 오너 / 개발자 (최성복)
  'dmplant@gmail.com',   // 백업
]

/**
 * 사용자가 슈퍼관리자인지 — 이메일 기준
 * - 클라이언트: useAuthStore의 user.email
 * - 서버: supabase.auth.getUser() 의 user.email
 */
export function isSuperAdmin(user: { email?: string | null } | null | undefined): boolean {
  const email = user?.email
  if (!email) return false
  return SUPER_ADMIN_EMAILS.map(e => e.toLowerCase()).includes(email.toLowerCase().trim())
}
