-- ════════════════════════════════════════════════════════════════════════════
-- 네이티브 소셜 로그인(Google/Apple) 계정 링크 준비
-- 사용법: Supabase Dashboard → SQL Editor → 전체 붙여넣기 → Run
--   ★ 반드시 Auth → Providers 에서 Google/Apple 을 켜기 "전에" 실행할 것.
-- ════════════════════════════════════════════════════════════════════════════
--
-- 왜 필요한가:
--   기존 회원은 이메일로 식별된다(public.users.id == auth.users.id).
--   회원이 같은 이메일의 Google/Apple 로 로그인하면 Supabase 가 기존 계정에
--   identity 를 "링크"해 같은 user_id 를 유지 → 모든 클럽·재무 데이터 보존.
--   그런데 이 자동 링크는 기존 유저의 이메일이 "확인됨(email_confirmed_at)"
--   상태일 때만 동작한다. 확인 안 된 유저는 새 auth.users 가 생겨 데이터가
--   끊긴다. 아래 백필로 모든 기존 유저를 확인 상태로 만든다.
--   (admin/create-member 라우트는 이미 email_confirm:true 라 신규는 안전)

-- 1) 기존 auth.users 전원 email 확인 백필 (idempotent)
UPDATE auth.users
SET email_confirmed_at = COALESCE(email_confirmed_at, now())
WHERE email_confirmed_at IS NULL;

-- 참고: password_set 은 컬럼 기본값이 true 이므로(auth_password_setup.sql),
--   OAuth 신규 가입자는 handle_new_user 트리거가 default(true)로 insert →
--   ForcePasswordSetup 모달이 뜨지 않는다. 별도 트리거 수정 불필요.
--   (password_set=false 는 admin 사전등록 회원에만 명시 설정됨)

-- ════════════════════════════════════════════════════════════════════════════
-- 완료 후 대시보드 설정(코드 아님):
--   Auth → URL Configuration → Redirect URLs 에 추가:
--     com.interstellargolf.app://auth/callback
--     https://dmplant-golf.vercel.app/**
--   Auth → Providers → Google (Google Cloud Web OAuth Client ID/Secret)
--   Auth → Providers → Apple (Services ID, Team ID, Key ID, .p8)
-- ════════════════════════════════════════════════════════════════════════════
