# 📝 SESSION_NOTES — dmplant-golf

- 마지막 작업 PC: BOOK5-DMC
- 마지막 작업 시간: 2026-08-13 11:05
- 브랜치: main (실작업은 worktree `fix/automigrate-idempotent` → PR #33 머지 완료)

## 마지막 작업 상태
- **회원명단 빈 화면 긴급 복구 완료.** 원인: 마이그레이션이 추가한 `club_memberships.withdrawn_by`(users 참조 FK)로 `users` embed 가 2개 관계 → PostgREST `more than one relationship` 에러 → 조회 전체 실패. 데이터는 전원 무사(MGF 29·300 11·이규식 포함).
- 즉시조치: 모호 FK 제약 제거 + PostgREST 스키마 캐시 리로드 → production 복구 확인.
- 영구조치: `users(...)` 무지정 embed 7곳 → `users:user_id(...)` 명시. PR #33 머지·배포(버전 7c842de).
- DB 스키마 자동동기화: Vercel + .env.local 에 `DATABASE_URL`(Supabase Session pooler URI) 설정 → `src/lib/db-migrate.ts` autoMigrate 가 배포마다 자동 실행. 전체 MIGRATIONS(19K자) 로컬 pg 로 직접 실행해 완전 동기화 확인.
- 앞선 세션들(모두 머지됨): 점수 서버 API(`/api/scores/*`, RLS 우회), 벌금 미납/수납 분리, RSVP 응답 후 안내팝업, PWA 컴파일타임 버전 박제 + SW 강제 새로고침(재설치 불필요).

## 수정/생성된 주요 파일
- src/app/(app)/members/page.tsx · meetings/page.tsx · finance/page.tsx · tournament/page.tsx
- src/app/api/push/diagnostics/route.ts
- src/app/api/scores/upsert/route.ts · handicap/route.ts (신규)
- src/lib/db-migrate.ts (autoMigrate)
- scripts/ 진단·복구 스크립트 다수

## 다음 이어갈 작업
- 회장님 폰 회원명단 정상표시 최종 확인 (화면 하단 `v:` 버전 회신 대기 → 7c842de 면 pull-to-refresh, 아니면 앱 완전종료 후 재실행)
- Vercel 재배포 로그에서 `[auto-migrate] ✓ DB schema up-to-date` 확인
- 메인 저장소 미커밋 WIP(login/setup-password, admin batch-register, scorecard OCR, useAutoRefresh) 정리·검증
- 필요 시 db-migrate.ts 에 withdrawn_by FK 재추가(embed 는 이미 전부 명시형이라 안전)
